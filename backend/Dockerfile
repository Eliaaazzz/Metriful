# syntax=docker/dockerfile:1

# Build stage
FROM gradle:8.10.2-jdk21-alpine AS build
WORKDIR /home/gradle/project

# Copy dependency files first (better layer caching)
COPY build.gradle.kts settings.gradle.kts gradle.properties ./
COPY gradle gradle
COPY gradlew ./
RUN chmod +x ./gradlew
# Download dependencies (cached unless build files change)
RUN ./gradlew dependencies --no-daemon || true

# Copy source code
COPY src src

# Build the JAR
RUN ./gradlew bootJar --no-daemon

# Runtime stage
FROM eclipse-temurin:21-jre-alpine

# Install font libraries (required for PDFBox/AWT on Alpine)
RUN apk add --no-cache fontconfig ttf-dejavu

# Create non-root user
RUN addgroup -S spring && adduser -S spring -G spring

WORKDIR /app

# Copy JAR from build stage
COPY --from=build --chown=spring:spring /home/gradle/project/build/libs/fitness-app.jar app.jar

# Switch to non-root user
USER spring:spring

# Expose application port
EXPOSE 8080

# Health check (Spring Boot Actuator)
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/actuator/health || exit 1

# JVM options for containerized environments (Cloud Run).
# Size the heap to a PERCENTAGE of the container memory (not a fixed -Xmx512m), so the heap
# grows with --memory and always leaves native headroom for AWT/ImageIO image buffers (which
# allocate off-heap) + OkHttp + threads. A fixed 512m heap on a 512Mi container left zero
# headroom and OOM-killed the instance under concurrent image load. TieredStopAtLevel=1 keeps
# cold starts fast (we scale out across many instances rather than up).
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=65.0 -XX:InitialRAMPercentage=40.0 -XX:+UseContainerSupport -XX:+TieredCompilation -XX:TieredStopAtLevel=1"

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
