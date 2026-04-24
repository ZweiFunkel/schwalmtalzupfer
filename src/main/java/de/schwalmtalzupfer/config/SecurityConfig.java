package de.schwalmtalzupfer.config;

import de.schwalmtalzupfer.member.Member;
import de.schwalmtalzupfer.member.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
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
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final MemberRepository memberRepository;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("http://localhost:3000", "http://localhost:8080"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(AbstractHttpConfigurer::disable)
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.GET, "/api/pages/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/contact").permitAll()
                .requestMatchers("/api/invitation/accept").permitAll()
                .requestMatchers("/api/invitation/invite").hasAnyRole("BOARD", "ADMIN")
                .requestMatchers("/api/gruppen/**").hasAnyRole("BOARD", "ADMIN")
                .requestMatchers("/api/locations/**").hasAnyRole("BOARD", "ADMIN")
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/member/**").authenticated()
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/intern/**").hasAnyRole("GUEST", "MEMBER", "BOARD", "ADMIN")
                .requestMatchers("/api/noten/**").hasAnyRole("GUEST", "MEMBER", "BOARD", "ADMIN")
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
            );

        return http.build();
    }

    @Bean
    public UserDetailsService userDetailsService() {
        return username -> {
            Member member = memberRepository.findByEmail(username)
                    .or(() -> memberRepository.findByUsername(username))
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
