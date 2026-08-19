package de.schwalmtalzupfer.config;

import de.schwalmtalzupfer.auth.JwtAuthFilter;
import de.schwalmtalzupfer.member.Member;
import de.schwalmtalzupfer.member.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;

// ...existing imports...

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final MemberRepository memberRepository;

    @Value("${app.cors.allowed-origins:http://localhost:3000,https://localhost:3000,http://localhost:8080}")
    private String[] allowedOrigins;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(allowedOrigins));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtAuthFilter jwtAuthFilter, PublicEndpointRateLimitFilter publicEndpointRateLimitFilter) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(AbstractHttpConfigurer::disable)
            .headers(headers -> headers
                .contentSecurityPolicy(csp -> csp
                    .policyDirectives("default-src 'self'; " +
                                     "script-src 'self' 'unsafe-inline' www.youtube.com www.youtube-nocookie.com s.ytimg.com js.stripe.com; " +
                                     "style-src 'self' 'unsafe-inline'; " +
                                     "frame-src www.youtube.com youtube.com www.youtube-nocookie.com blob: js.stripe.com hooks.stripe.com; " +
                                     "connect-src 'self' www.youtube.com www.youtube-nocookie.com s.ytimg.com api.stripe.com; " +
                                     "img-src 'self' data: blob: www.youtube.com i.ytimg.com; " +
                                     "media-src 'self' blob:; " +
                                     "worker-src blob:;")
                )
            )
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.GET, "/api/pages/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/termine/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/kalender/termine").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/kalender/ics").permitAll()
                .requestMatchers("/api/kalender/benachrichtigungen").authenticated()
                .requestMatchers("/api/kalender/**").hasAnyRole("BOARD", "ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/galerie/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/galerie-intern/**").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/contact").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/beitritt").permitAll()
                .requestMatchers("/api/beitritt/**").hasAnyRole("CHEF", "ADMIN")
                .requestMatchers("/api/invitation/accept").permitAll()
                .requestMatchers("/api/invitation/details").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/payment/registration-intent").permitAll()
                .requestMatchers("/api/payment/**").authenticated()
                .requestMatchers("/api/stripe/webhook").permitAll()
                .requestMatchers("/api/invitation/invite").hasAnyRole("BOARD", "ADMIN")
                .requestMatchers("/api/gruppen/**").hasAnyRole("BOARD", "CHEF", "ADMIN")
                .requestMatchers("/api/locations/**").hasAnyRole("BOARD", "CHEF", "ADMIN")
                .requestMatchers("/api/pricing/**").hasAnyRole("BOARD", "CHEF", "ADMIN")
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/member/**").authenticated()
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/intern/**").hasAnyRole("GUEST", "MEMBER", "BOARD", "CHEF", "ADMIN")
                .requestMatchers("/api/noten/**").hasAnyRole("GUEST", "MEMBER", "BOARD", "CHEF", "ADMIN")
                .requestMatchers("/**").permitAll()
            )
            .formLogin(form -> form
                .loginProcessingUrl("/api/auth/login")
                .successHandler((req, res, auth) -> {
                    res.setStatus(200);
                    res.setContentType("application/json;charset=UTF-8");
                    String role = auth.getAuthorities().stream()
                            .findFirst().map(a -> a.getAuthority()).orElse("ROLE_MEMBER");
                    res.getWriter().write("{\"email\":\"" + auth.getName() + "\",\"role\":\"" + role + "\"}");
                })
                .failureHandler((req, res, ex) -> {
                    res.setStatus(401);
                    res.setContentType("application/json;charset=UTF-8");
                    res.getWriter().write("{\"error\":\"Ungültige Anmeldedaten\"}");
                })
                .permitAll()
            )
            .logout(logout -> logout
                .logoutUrl("/api/auth/logout")
                .logoutSuccessHandler((req, res, auth) -> res.setStatus(200))
            )
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED))
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(publicEndpointRateLimitFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public UserDetailsService userDetailsService() {
        return username -> {
            Member member = memberRepository.findByEmailIgnoreCase(username)
                    .or(() -> memberRepository.findByUsernameIgnoreCase(username))
                    .orElseThrow(() -> new UsernameNotFoundException("Benutzer nicht gefunden: " + username));
            String role = "ROLE_" + member.getRole().name();
            // Use username if available, otherwise email
            String loginName = member.getUsername() != null ? member.getUsername() : member.getEmail();
            return new User(loginName, member.getPasswordHash(),
                    List.of(new SimpleGrantedAuthority(role)));
        };
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}