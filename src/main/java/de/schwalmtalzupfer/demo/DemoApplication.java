package de.schwalmtalzupfer.demo;

import de.schwalmtalzupfer.SchwalmtalzupferApplication;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** @deprecated Einstiegspunkt ist nun {@link SchwalmtalzupferApplication} */
@SpringBootApplication
public class DemoApplication {

	public static void main(String[] args) {
		SpringApplication.run(SchwalmtalzupferApplication.class, args);
	}

}
