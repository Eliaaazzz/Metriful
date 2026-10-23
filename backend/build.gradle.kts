import org.springframework.boot.gradle.tasks.bundling.BootJar

plugins {
    java
    id("org.springframework.boot") version "3.3.5"
    id("io.spring.dependency-management") version "1.1.7"
    id("org.flywaydb.flyway") version "9.22.3"
    jacoco
}

group = "com.fitnessapp"
version = "0.0.2-SNAPSHOT"
description = "Fitness App MVP Backend"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(21)
	}
}

repositories {
	mavenCentral()
}

configurations {
	compileOnly {
		extendsFrom(configurations.annotationProcessor.get())
	}
}

dependencies {
	implementation("org.springframework.boot:spring-boot-starter-actuator")
	implementation("org.springframework.boot:spring-boot-starter-data-jpa")
	implementation("org.springframework.boot:spring-boot-starter-data-redis")
	implementation("org.springframework.boot:spring-boot-starter-validation")
	implementation("org.springframework.boot:spring-boot-starter-web")
	implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
	implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.flywaydb:flyway-core:10.17.0")
    implementation("org.flywaydb:flyway-database-postgresql:10.17.0")
	implementation("org.springframework.boot:spring-boot-starter-cache")
	implementation("com.github.ben-manes.caffeine:caffeine")
	implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.2.0")
	implementation("com.google.api-client:google-api-client:2.2.0")
	implementation("com.google.apis:google-api-services-youtube:v3-rev20230502-2.0.0")
	implementation("com.google.http-client:google-http-client-jackson2:1.43.3")
    implementation("org.apache.pdfbox:pdfbox:2.0.31")
    // Behavior Insights — Welch's t-test, Cohen's d (feature #221)
    implementation("org.apache.commons:commons-math3:3.6.1")
	// OpenAI SDK for GPT-4 Vision
	implementation("com.theokanning.openai-gpt3-java:service:0.18.2")
	// HTTP client for Claude and Gemini APIs (using OkHttp)
	implementation("com.squareup.okhttp3:okhttp:4.12.0")
	// Google Auth for Vertex AI Application Default Credentials
	implementation("com.google.auth:google-auth-library-oauth2-http:1.23.0")
    implementation("software.amazon.awssdk:s3:2.29.0")
	// OpenAI Java SDK for embeddings (already have openai-gpt3-java above for chat)
	// Using OkHttp for embeddings API call to avoid SDK version conflicts
	// JWT for authentication
	implementation("io.jsonwebtoken:jjwt-api:0.12.6")
	runtimeOnly("io.jsonwebtoken:jjwt-impl:0.12.6")
	runtimeOnly("io.jsonwebtoken:jjwt-jackson:0.12.6")
	// Auth0 java-jwt for Apple Sign In token verification
	implementation("com.auth0:java-jwt:4.4.0")
	implementation("com.fasterxml.jackson.core:jackson-databind")
	runtimeOnly("org.postgresql:postgresql")
	// pgvector type support for Hibernate 6.x
	implementation("org.hibernate.orm:hibernate-vector:6.5.3.Final")
	compileOnly("org.projectlombok:lombok")
	annotationProcessor("org.projectlombok:lombok")
	annotationProcessor("org.springframework.boot:spring-boot-configuration-processor")
	developmentOnly("org.springframework.boot:spring-boot-devtools")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.boot:spring-boot-testcontainers")
    testImplementation("org.springframework.security:spring-security-test")
    testImplementation("com.h2database:h2")
    testImplementation("org.testcontainers:junit-jupiter:1.20.1")
    testImplementation("org.testcontainers:postgresql:1.20.1")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<Test> {
    useJUnitPlatform()

    // In CI without Docker, skip Testcontainers-based integration tests
    if (project.hasProperty("skipContainerTests")) {
        exclude("**/DatabaseSchemaIntegrationTest*")
        exclude("**/RepositoryTests*")
        exclude("**/FitnessAppApplicationTests*")
        exclude("**/*IntegrationTest*")
        exclude("**/*RepositoryTest*")
    }
}

tasks.jacocoTestReport {
    dependsOn(tasks.test)
    reports {
        xml.required.set(true)
        html.required.set(true)
    }
}

tasks.named<BootJar>("bootJar") {
    archiveFileName.set("fitness-app.jar")
}

flyway {
	url = System.getenv("SPRING_DATASOURCE_URL") ?: "jdbc:postgresql://localhost:5432/fitness_mvp"
	user = System.getenv("SPRING_DATASOURCE_USERNAME") ?: "fitnessuser"
	password = System.getenv("SPRING_DATASOURCE_PASSWORD") ?: "dev_password"
	schemas = arrayOf("public")
	baselineOnMigrate = true
}
