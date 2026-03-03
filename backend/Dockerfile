# Stage 1: Build the application using Maven and JDK 25
FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /app
COPY . .
RUN mvn clean package -DskipTests

# Stage 2: Run the application using the standard JDK 25 runtime
# Switched from 'alpine' to standard to fix vulnerability warnings
FROM eclipse-temurin:25-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]