package com.vylop.backend.model;

import java.util.List;

public class UserMessage {
    private String username;
    // CHANGED: From List<String> to List<RoomParticipant>
    private List<RoomParticipant> users; 
    private String type; // JOIN, LEAVE, ROLE_UPDATE, KICK

    public UserMessage() {}

    public UserMessage(String username, List<RoomParticipant> users, String type) {
        this.username = username;
        this.users = users;
        this.type = type;
    }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public List<RoomParticipant> getUsers() { return users; }
    public void setUsers(List<RoomParticipant> users) { this.users = users; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
}