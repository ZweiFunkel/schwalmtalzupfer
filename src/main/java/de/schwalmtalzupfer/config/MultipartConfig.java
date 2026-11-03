package de.schwalmtalzupfer.config;

import jakarta.servlet.MultipartConfigElement;
import org.springframework.boot.servlet.MultipartConfigFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.unit.DataSize;

/**
 * Upload-Limits fuer Noten, Assets etc. Ohne eigene Vorgabe gilt Springs Standard von 1 MB pro Datei,
 * woran z.B. PDF-Mappen scheitern. nginx begrenzt den Request ohnehin auf 50 MB. Fest im Code, weil die
 * application.yml pro Umgebung liegt und nicht eingecheckt wird.
 */
@Configuration
public class MultipartConfig {

    @Bean
    public MultipartConfigElement multipartConfigElement() {
        MultipartConfigFactory factory = new MultipartConfigFactory();
        factory.setMaxFileSize(DataSize.ofMegabytes(50));
        factory.setMaxRequestSize(DataSize.ofMegabytes(50));
        return factory.createMultipartConfig();
    }
}
