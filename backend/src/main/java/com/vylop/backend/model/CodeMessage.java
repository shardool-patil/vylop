package com.vylop.backend.model;

public class CodeMessage {
    private String sender;
    private String content;
    private String language;
    private String type;
    private String fileName; // --- NEW: Track which file is being edited ---

    public CodeMessage() {
    }

    public CodeMessage(String sender, String content, String language, String type, String fileName) {
        this.sender = sender;
        this.content = content;
        this.language = language;
        this.type = type;
        this.fileName = fileName;
    }

    public String getSender() {
        return sender;
    }

    public void setSender(String sender) {
        this.sender = sender;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getLanguage() {
        return language;
    }

    public void setLanguage(String language) {
        this.language = language;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }
}