package com.vylop.backend.controller;

import com.vylop.backend.model.CodeMessage;
import com.vylop.backend.model.UserMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Controller
public class EditorController {

    private static final Logger logger = LoggerFactory.getLogger(EditorController.class);
    private final SimpMessagingTemplate messagingTemplate;
    
    // Map to track users in each room: Key = roomId, Value = Set of usernames
    private static final Map<String, Set<String>> roomUsers = new ConcurrentHashMap<>();

    public EditorController(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Handles real-time code synchronization
     */
    @MessageMapping("/code/{roomId}")
    public void sendCode(@DestinationVariable String roomId, @Payload CodeMessage message) {
        // Broadcast the code content to all subscribers of the room topic
        messagingTemplate.convertAndSend("/topic/code/" + roomId, message);
    }

    /**
     * Handles a user joining a room and broadcasts the updated user list
     */
    @MessageMapping("/room/{roomId}/join")
    public void joinRoom(@DestinationVariable String roomId, @Payload UserMessage message, SimpMessageHeaderAccessor headerAccessor) {
        String username = message.getUsername();
        
        // Add user to the room's set
        roomUsers.computeIfAbsent(roomId, k -> Collections.synchronizedSet(new HashSet<>())).add(username);
        
        logger.info("User {} joined Room {}", username, roomId);

        // Prepare the response with the full list of active users in the room
        UserMessage response = new UserMessage(
            username, 
            new ArrayList<>(roomUsers.get(roomId)), 
            "JOIN"
        );

        // Broadcast to /topic/users/{roomId} so the frontend sidebar updates
        messagingTemplate.convertAndSend("/topic/users/" + roomId, response);
    }

    /**
     * Handles a user explicitly leaving a room and updates the list for remaining users
     */
    @MessageMapping("/room/{roomId}/leave")
    public void leaveRoom(@DestinationVariable String roomId, @Payload UserMessage message) {
        String username = message.getUsername();
        
        if (roomUsers.containsKey(roomId)) {
            roomUsers.get(roomId).remove(username);
            logger.info("User {} left Room {}", username, roomId);
            
            // Broadcast the updated list with the "LEAVE" type to trigger leave notifications
            UserMessage response = new UserMessage(
                username, 
                new ArrayList<>(roomUsers.get(roomId)), 
                "LEAVE"
            );
            messagingTemplate.convertAndSend("/topic/users/" + roomId, response);
        }
    }
}