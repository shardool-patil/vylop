package com.vylop.backend.controller;

import com.vylop.backend.model.ChatMessage;
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
    
    // Thread-safe map to track users in each room: Key = roomId, Value = Set of usernames
    private static final Map<String, Set<String>> roomUsers = new ConcurrentHashMap<>();

    public EditorController(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    // Static getter for the WebSocketEventListener to access the user list
    public static Map<String, Set<String>> getRoomUsers() {
        return roomUsers;
    }

    /**
     * Handles real-time code updates.
     */
    @MessageMapping("/code/{roomId}")
    public void sendCode(@DestinationVariable String roomId, @Payload CodeMessage message) {
        messagingTemplate.convertAndSend("/topic/code/" + roomId, message);
    }

    /**
     * Handles real-time chat messages.
     */
    @MessageMapping("/chat/{roomId}")
    public void sendChatMessage(@DestinationVariable String roomId, @Payload ChatMessage message) {
        messagingTemplate.convertAndSend("/topic/chat/" + roomId, message);
    }

    /**
     * Handles a user joining the room.
     */
    @MessageMapping("/room/{roomId}/join")
    public void joinRoom(@DestinationVariable String roomId, @Payload UserMessage message, SimpMessageHeaderAccessor headerAccessor) {
        String username = message.getUsername();
        
        // Store session attributes for the Disconnect Listener
        headerAccessor.getSessionAttributes().put("username", username);
        headerAccessor.getSessionAttributes().put("roomId", roomId);

        // Add user to the room
        roomUsers.computeIfAbsent(roomId, k -> Collections.synchronizedSet(new HashSet<>())).add(username);
        
        logger.info("User {} joined Room {}", username, roomId);

        // Broadcast the updated user list to everyone
        UserMessage response = new UserMessage(
            username, 
            new ArrayList<>(roomUsers.get(roomId)), 
            "JOIN"
        );
        messagingTemplate.convertAndSend("/topic/users/" + roomId, response);
    }

    /**
     * Handles a user explicitly leaving the room (via button click).
     */
    @MessageMapping("/room/{roomId}/leave")
    public void leaveRoom(@DestinationVariable String roomId, @Payload UserMessage message) {
        String username = message.getUsername();
        
        if (roomUsers.containsKey(roomId)) {
            roomUsers.get(roomId).remove(username);
            logger.info("User {} left Room {}", username, roomId);
            
            // Broadcast the updated user list so frontend removes them
            UserMessage response = new UserMessage(
                username, 
                new ArrayList<>(roomUsers.get(roomId)), 
                "LEAVE"
            );
            messagingTemplate.convertAndSend("/topic/users/" + roomId, response);
        }
    }
}