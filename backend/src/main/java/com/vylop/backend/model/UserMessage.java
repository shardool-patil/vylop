package com.vylop.backend.model;

import java.util.List;

public class UserMessage {
    private String username;
    private List<String> activeUsers;
    private String type; // "JOIN", "LEAVE", or "UPDATE"

    public UserMessage() {}

    public UserMessage(String username, List<String> activeUsers, String type) {
        this.username = username;
        this.activeUsers = activeUsers;
        this.type = type;
    }

    // Getters and Setters
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public List<String> getActiveUsers() { return activeUsers; }
    public void setActiveUsers(List<String> activeUsers) { this.activeUsers = activeUsers; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
}