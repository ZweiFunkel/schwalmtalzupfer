package de.schwalmtalzupfer;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class SchwalmtalzupferApplication {

    public static void main(String[] args) {
        SpringApplication.run(SchwalmtalzupferApplication.class, args);
    }
}

