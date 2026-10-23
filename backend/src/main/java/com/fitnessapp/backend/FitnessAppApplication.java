package com.fitnessapp.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@ConfigurationPropertiesScan(basePackages = {
    "com.fitnessapp.backend.config"
})
@ComponentScan(basePackages = {
    "com.fitnessapp.backend",
    "com.aura"
})
@EntityScan(basePackages = {
    "com.fitnessapp.backend",
    "com.aura"
})
@EnableCaching
@EnableScheduling
@EnableJpaRepositories(basePackages = {
    "com.fitnessapp.backend.user.repository",
    "com.fitnessapp.backend.recipe.repository",
    "com.fitnessapp.backend.nutrition.repository",
    "com.fitnessapp.backend.workout.repository",
    "com.fitnessapp.backend.usda.repository",
    "com.fitnessapp.backend.goals.repository",
    "com.fitnessapp.backend.repository",
    "com.fitnessapp.backend.goals.repository",
    "com.fitnessapp.backend.weight.repository",
    "com.fitnessapp.backend.behavior.repository",
    "com.aura.repository"
})
public class FitnessAppApplication {

    public static void main(String[] args) {
        SpringApplication.run(FitnessAppApplication.class, args);
    }
}


