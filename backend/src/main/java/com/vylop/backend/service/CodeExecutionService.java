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
        try {
            switch (language.toLowerCase()) {
                case "java":
                    return executeJava(input, mainFileName, files);
                case "python":
                    return executePython(input, mainFileName, files);
                case "cpp":
                case "c++":
                    return executeCpp(input, mainFileName, files);
                case "javascript":
                    return executeJavascript(input, mainFileName, files);
                case "typescript":
                    return executeTypescript(input, mainFileName, files);
                case "go":
                    return executeGo(input, mainFileName, files);
                case "rust":
                    return executeRust(input, mainFileName, files);
                default:
                    return "Error: Language '" + language + "' is not supported yet.";
            }
        } catch (Exception e) {
            return "Server Error: " + e.getMessage();
        }
    }

    // --- NEW: Write all files to the temporary directory ---
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

    // --- JAVA EXECUTION ---
    private String executeJava(String input, String mainFileName, Map<String, String> files) throws IOException, InterruptedException {
        Path tempDir = Files.createTempDirectory("vylop_java");
        writeFiles(tempDir, files);

        // --- NEW: Compile ALL .java files found in the payload ---
        List<String> compileCmd = new ArrayList<>();
        compileCmd.add("javac");
        for (String fName : files.keySet()) {
            if (fName.endsWith(".java")) {
                compileCmd.add(fName);
            }
        }

        ProcessBuilder compile = new ProcessBuilder(compileCmd);
        compile.directory(tempDir.toFile());
        Process cProcess = compile.start();
        
        if (cProcess.waitFor() != 0) {
            return "Compilation Error:\n" + readStream(cProcess.getErrorStream());
        }

        // Run (Drop the .java extension to get the pure Class name)
        String className = mainFileName.replace(".java", "");
        ProcessBuilder run = new ProcessBuilder("java", "-cp", tempDir.toString(), className);
        return runProcess(run, tempDir, input); 
    }

    // --- PYTHON EXECUTION ---
    private String executePython(String input, String mainFileName, Map<String, String> files) throws IOException, InterruptedException {
        Path tempDir = Files.createTempDirectory("vylop_python");
        writeFiles(tempDir, files);

        ProcessBuilder run = new ProcessBuilder("python", mainFileName);
        return runProcess(run, tempDir, input); 
    }

    // --- C++ EXECUTION ---
    private String executeCpp(String input, String mainFileName, Map<String, String> files) throws IOException, InterruptedException {
        Path tempDir = Files.createTempDirectory("vylop_cpp");
        writeFiles(tempDir, files);
        
        boolean isWindows = System.getProperty("os.name").toLowerCase().contains("win");
        String exeName = isWindows ? "main.exe" : "main";
        File exeFile = new File(tempDir.toFile(), exeName);

        // Compile ALL .cpp files
        List<String> compileCmd = new ArrayList<>();
        compileCmd.add("g++");
        for (String fName : files.keySet()) {
            if (fName.endsWith(".cpp") || fName.endsWith(".c") || fName.endsWith(".h")) {
                compileCmd.add(fName);
            }
        }
        compileCmd.add("-o");
        compileCmd.add(exeFile.getAbsolutePath());

        ProcessBuilder compile = new ProcessBuilder(compileCmd);
        compile.directory(tempDir.toFile());
        Process cProcess = compile.start();

        if (cProcess.waitFor() != 0) {
            return "Compilation Error:\n" + readStream(cProcess.getErrorStream());
        }

        ProcessBuilder run = new ProcessBuilder(exeFile.getAbsolutePath());
        return runProcess(run, tempDir, input); 
    }

    // --- JAVASCRIPT EXECUTION ---
    private String executeJavascript(String input, String mainFileName, Map<String, String> files) throws IOException, InterruptedException {
        Path tempDir = Files.createTempDirectory("vylop_js");
        writeFiles(tempDir, files);

        ProcessBuilder run = new ProcessBuilder("node", mainFileName);
        return runProcess(run, tempDir, input);
    }

    // --- TYPESCRIPT EXECUTION ---
    private String executeTypescript(String input, String mainFileName, Map<String, String> files) throws IOException, InterruptedException {
        Path tempDir = Files.createTempDirectory("vylop_ts");
        writeFiles(tempDir, files);

        boolean isWindows = System.getProperty("os.name").toLowerCase().contains("win");
        String npxCmd = isWindows ? "npx.cmd" : "npx";

        ProcessBuilder run = new ProcessBuilder(npxCmd, "ts-node", mainFileName);
        return runProcess(run, tempDir, input);
    }

    // --- GO EXECUTION ---
    private String executeGo(String input, String mainFileName, Map<String, String> files) throws IOException, InterruptedException {
        Path tempDir = Files.createTempDirectory("vylop_go");
        writeFiles(tempDir, files);

        ProcessBuilder run = new ProcessBuilder("go", "run", mainFileName);
        return runProcess(run, tempDir, input);
    }

    // --- RUST EXECUTION ---
    private String executeRust(String input, String mainFileName, Map<String, String> files) throws IOException, InterruptedException {
        Path tempDir = Files.createTempDirectory("vylop_rust");
        writeFiles(tempDir, files);
        
        boolean isWindows = System.getProperty("os.name").toLowerCase().contains("win");
        String exeName = isWindows ? "main.exe" : "main";
        File exeFile = new File(tempDir.toFile(), exeName);

        ProcessBuilder compile = new ProcessBuilder("rustc", mainFileName, "-o", exeFile.getAbsolutePath());
        compile.directory(tempDir.toFile());
        Process cProcess = compile.start();

        if (cProcess.waitFor() != 0) {
            return "Compilation Error:\n" + readStream(cProcess.getErrorStream());
        }

        ProcessBuilder run = new ProcessBuilder(exeFile.getAbsolutePath());
        return runProcess(run, tempDir, input);
    }

    // --- COMMON RUNNER ---
    private String runProcess(ProcessBuilder pb, Path tempDir, String input) throws IOException, InterruptedException {
        pb.directory(tempDir.toFile());
        Process process = pb.start();

        try (OutputStream os = process.getOutputStream();
             BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(os))) {
            
            if (input != null && !input.isEmpty()) {
                writer.write(input);
                if (!input.endsWith("\n")) {
                    writer.write("\n");
                }
            }
        } 

        if (!process.waitFor(10, TimeUnit.SECONDS)) { 
            process.destroyForcibly();
            return "Error: Execution timed out (Process exceeded 10 seconds). Check for infinite loops!";
        }

        String output = readStream(process.getInputStream());
        String error = readStream(process.getErrorStream());

        return error.isEmpty() ? output : output + "\nError Output:\n" + error;
    }

    private String readStream(InputStream stream) {
        return new BufferedReader(new InputStreamReader(stream))
                .lines().collect(Collectors.joining("\n"));
    }
}