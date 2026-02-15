package com.vylop.backend.service;

import org.springframework.stereotype.Service;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
public class CodeExecutionService {

    // 1. Update the main method signature
    public String executeCode(String language, String code, String input) {
        try {
            switch (language.toLowerCase()) {
                case "java":
                    return executeJava(code, input);
                case "python":
                    return executePython(code, input);
                case "cpp":
                case "c++":
                    return executeCpp(code, input);
                default:
                    return "Error: Language '" + language + "' is not supported yet.";
            }
        } catch (Exception e) {
            return "Server Error: " + e.getMessage();
        }
    }

    // --- JAVA EXECUTION ---
    private String executeJava(String code, String input) throws IOException, InterruptedException {
        Path tempDir = Files.createTempDirectory("vylop_java");
        File sourceFile = new File(tempDir.toFile(), "Main.java");

        try (FileWriter writer = new FileWriter(sourceFile)) {
            writer.write(code);
        }

        // Compile
        ProcessBuilder compile = new ProcessBuilder("javac", sourceFile.getAbsolutePath());
        compile.directory(tempDir.toFile());
        Process cProcess = compile.start();
        
        // Check compilation
        if (cProcess.waitFor() != 0) {
            return "Compilation Error:\n" + readStream(cProcess.getErrorStream());
        }

        // Run
        ProcessBuilder run = new ProcessBuilder("java", "-cp", tempDir.toString(), "Main");
        return runProcess(run, tempDir, input); 
    }

    // --- PYTHON EXECUTION ---
    private String executePython(String code, String input) throws IOException, InterruptedException {
        Path tempDir = Files.createTempDirectory("vylop_python");
        File sourceFile = new File(tempDir.toFile(), "script.py");

        try (FileWriter writer = new FileWriter(sourceFile)) {
            writer.write(code);
        }

        // Python is interpreted, so we just run it. 
        // NOTE: Use "python3" on Mac/Linux, "python" on Windows usually.
        ProcessBuilder run = new ProcessBuilder("python", sourceFile.getAbsolutePath());
        return runProcess(run, tempDir, input); 
    }

    // --- C++ EXECUTION ---
    private String executeCpp(String code, String input) throws IOException, InterruptedException {
        Path tempDir = Files.createTempDirectory("vylop_cpp");
        File sourceFile = new File(tempDir.toFile(), "main.cpp");
        File exeFile = new File(tempDir.toFile(), "main.exe"); // .exe for Windows

        try (FileWriter writer = new FileWriter(sourceFile)) {
            writer.write(code);
        }

        // Compile: g++ main.cpp -o main.exe
        ProcessBuilder compile = new ProcessBuilder("g++", sourceFile.getAbsolutePath(), "-o", exeFile.getAbsolutePath());
        compile.directory(tempDir.toFile());
        Process cProcess = compile.start();

        if (cProcess.waitFor() != 0) {
            return "Compilation Error:\n" + readStream(cProcess.getErrorStream());
        }

        // Run
        ProcessBuilder run = new ProcessBuilder(exeFile.getAbsolutePath());
        return runProcess(run, tempDir, input); 
    }

    // --- COMMON RUNNER ---
    private String runProcess(ProcessBuilder pb, Path tempDir, String input) throws IOException, InterruptedException {
        pb.directory(tempDir.toFile());
        Process process = pb.start();

        // --- FIX: Always open and CLOSE the stream, even if input is empty ---
        try (OutputStream os = process.getOutputStream();
             BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(os))) {
            
            if (input != null && !input.isEmpty()) {
                writer.write(input);
                // Ensure a newline at the end so Scanner.nextLine() works properly
                if (!input.endsWith("\n")) {
                    writer.write("\n");
                }
            }
        } 
        // The stream closes automatically here. 
        // This tells Java/Python/C++: "No more input coming, stop waiting."
        // ---------------------------------------------------------------------

        if (!process.waitFor(5, TimeUnit.SECONDS)) {
            process.destroy();
            return "Error: Execution timed out (infinite loop?).";
        }

        String output = readStream(process.getInputStream());
        String error = readStream(process.getErrorStream());

        // Cleanup temporary files
        // (For production, consider using a more robust cleanup strategy)
        // tempDir.toFile().deleteOnExit(); 

        return error.isEmpty() ? output : output + "\nError Output:\n" + error;
    }

    private String readStream(InputStream stream) {
        return new BufferedReader(new InputStreamReader(stream))
                .lines().collect(Collectors.joining("\n"));
    }
}