package com.vylop.backend.model;

public class RoomParticipant {
    private String username;
    private ParticipantRole role;

    public RoomParticipant() {}

    public RoomParticipant(String username, ParticipantRole role) {
        this.username = username;
        this.role = role;
    }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public ParticipantRole getRole() { return role; }
    public void setRole(ParticipantRole role) { this.role = role; }
}