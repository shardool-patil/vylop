package com.vylop.backend.service;

import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
public class CodeExecutionService {

    public String executeCode(String language, String code, String input, String mainFileName, Map<String, String> files) {
        Path tempDir = null;
        try {
            // 1. Create temporary directory and write all files
            tempDir = Files.createTempDirectory("vylop_sandbox_");
            writeFiles(tempDir, files);

            // 2. Determine the Docker Image and the Shell Command to run inside it
            String dockerImage;
            String shellCommand;

            switch (language.toLowerCase()) {
                case "java":
                    dockerImage = "eclipse-temurin:17-alpine";
                    String className = mainFileName.replace(".java", "");
                    shellCommand = "javac *.java && java " + className;
                    break;
                case "python":
                    dockerImage = "python:3.10-alpine";
                    shellCommand = "python " + mainFileName;
                    break;
                case "cpp":
                case "c++":
                    dockerImage = "gcc:latest";
                    shellCommand = "g++ *.cpp -o main && ./main";
                    break;
                case "javascript":
                    dockerImage = "node:18-alpine";
                    shellCommand = "node " + mainFileName;
                    break;
                case "typescript":
                    dockerImage = "denoland/deno:alpine"; 
                    shellCommand = "deno run " + mainFileName;
                    break;
                case "go":
                    dockerImage = "golang:alpine";
                    // THE FIX: Explicitly route the build cache to /tmp and disable CGO for Alpine compatibility
                    shellCommand = "GO111MODULE=off CGO_ENABLED=0 GOCACHE=/tmp go run " + mainFileName;
                    break;
                case "rust":
                    dockerImage = "rust:alpine";
                    shellCommand = "rustc " + mainFileName + " -o main && ./main";
                    break;
                default:
                    return "Error: Language '" + language + "' is not supported yet.";
            }

            // 3. Build the highly restricted Docker Command
            List<String> command = new ArrayList<>();
            command.add("docker");
            command.add("run");
            command.add("--rm");               // Destroy container after run
            command.add("-i");                 // Keep STDIN open for inputs
            command.add("--network");          
            command.add("none");               // NO INTERNET ACCESS
            command.add("--memory");
            command.add("256m");               // Max 256MB RAM
            command.add("-v");
            // Map the host's temp directory to the container's /app directory
            command.add(tempDir.toAbsolutePath().toString() + ":/app");
            command.add("-w");
            command.add("/app");               // Set working directory
            command.add(dockerImage);          // The language environment
            command.add("sh");
            command.add("-c");
            command.add(shellCommand);         // The execution command

            // 4. Run the Sandbox
            ProcessBuilder pb = new ProcessBuilder(command);
            return runProcess(pb, input);

        } catch (Exception e) {
            return "Sandbox Error: " + e.getMessage();
        } finally {
            // 5. Always clean up the temp directory on the host machine
            if (tempDir != null) {
                deleteDirectory(tempDir.toFile());
            }
        }
    }

    private void writeFiles(Path tempDir, Map<String, String> files) throws IOException {
        if (files != null && !files.isEmpty()) {
            for (Map.Entry<String, String> entry : files.entrySet()) {
                File file = new File(tempDir.toFile(), entry.getKey());
                try (FileWriter writer = new FileWriter(file)) {
                    writer.write(entry.getValue());
                }
            }
        }
    }

    private String runProcess(ProcessBuilder pb, String input) throws IOException, InterruptedException {
        Process process = pb.start();

        // Pipe user STDIN directly into the Docker container
        try (OutputStream os = process.getOutputStream();
             BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(os))) {
            
            if (input != null && !input.isEmpty()) {
                writer.write(input);
                if (!input.endsWith("\n")) {
                    writer.write("\n");
                }
            }
        } 

        // FIX: Bumped timeout to 20 seconds to handle WSL2 overhead alongside the new Postgres DB
        if (!process.waitFor(20, TimeUnit.SECONDS)) { 
            process.destroyForcibly();
            return "Timeout Error: Execution exceeded 20 seconds. Check for infinite loops or Docker image pulling!";
        }

        // Capture Output
        String output = readStream(process.getInputStream());
        String error = readStream(process.getErrorStream());

        return error.isEmpty() ? output : output + "\nError Output:\n" + error;
    }

    private String readStream(InputStream stream) {
        return new BufferedReader(new InputStreamReader(stream))
                .lines().collect(Collectors.joining("\n"));
    }

    // Helper to recursively delete the temporary code folder
    private void deleteDirectory(File directoryToBeDeleted) {
        File[] allContents = directoryToBeDeleted.listFiles();
        if (allContents != null) {
            for (File file : allContents) {
                deleteDirectory(file);
            }
        }
        directoryToBeDeleted.delete();
    }
}