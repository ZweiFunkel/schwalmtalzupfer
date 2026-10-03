package de.schwalmtalzupfer.auth;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.session.autoconfigure.SessionAutoConfiguration;
import org.springframework.boot.session.jdbc.autoconfigure.JdbcSessionAutoConfiguration;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.session.Session;
import org.springframework.session.SessionRepository;
import org.springframework.session.jdbc.JdbcIndexedSessionRepository;
import org.springframework.transaction.PlatformTransactionManager;
import static org.assertj.core.api.Assertions.assertThat;

class SessionPersistenceTest {
    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void authenticatedSessionSurvivesApplicationContextRestartAndLogoutDeletesIt() throws Exception {
        var source = new DriverManagerDataSource("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", "");
        var jdbc = new JdbcTemplate(source);
        // Use the existing production migration's session DDL, not a separate test schema.
        String ddl = Files.readString(Path.of("src/main/resources/db/migration/V8__spring_session_and_nav_config.sql"))
                .split("-- nav_config default")[0];
        for (String sql : ddl.split(";")) if (!sql.isBlank()) jdbc.execute(sql);
        var runner = new WebApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(JdbcSessionAutoConfiguration.class, SessionAutoConfiguration.class))
                .withBean(DataSource.class, () -> source)
                .withBean(PlatformTransactionManager.class, () -> new DataSourceTransactionManager(source))
                .withPropertyValues("spring.session.jdbc.initialize-schema=never", "spring.session.timeout=30d",
                        "server.servlet.session.cookie.max-age=30d");
        var id = new AtomicReference<String>();
        runner.run(context -> {
            assertThat(context).hasNotFailed().hasSingleBean(JdbcIndexedSessionRepository.class);
            SessionRepository repository = context.getBean(JdbcIndexedSessionRepository.class);
            Session session = repository.createSession();
            var principal = User.withUsername("session-test").password("unused").roles("MEMBER").build();
            var authentication = UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities());
            session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, new SecurityContextImpl(authentication));
            repository.save(session);
            id.set(session.getId());
            assertThat(session.getMaxInactiveInterval()).isEqualTo(Duration.ofDays(30));
        });
        // The first context is closed; a fresh application context uses the same database.
        runner.run(context -> {
            assertThat(context).hasNotFailed();
            SessionRepository repository = context.getBean(JdbcIndexedSessionRepository.class);
            Session restored = repository.findById(id.get());
            assertThat(restored).isNotNull();
            SecurityContextImpl security = restored.getAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);
            assertThat(security.getAuthentication().getName()).isEqualTo("session-test");
            assertThat(security.getAuthentication().isAuthenticated()).isTrue();
            repository.deleteById(id.get());
            assertThat(repository.findById(id.get())).isNull();
        });
        jdbc.execute("SHUTDOWN");
    }
}
