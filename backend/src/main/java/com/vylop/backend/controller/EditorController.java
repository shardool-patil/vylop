package com.vylop.backend.controller;

import com.vylop.backend.model.ChatMessage;
import com.vylop.backend.model.CodeMessage;
import com.vylop.backend.model.CursorMessage;
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
    
    private static final Map<String, Set<String>> roomUsers = new ConcurrentHashMap<>();

    public EditorController(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public static Map<String, Set<String>> getRoomUsers() {
        return roomUsers;
    }

    @MessageMapping("/code/{roomId}")
    public void sendCode(@DestinationVariable String roomId, @Payload CodeMessage message) {
        messagingTemplate.convertAndSend("/topic/code/" + roomId, message);
    }

    @MessageMapping("/chat/{roomId}")
    public void sendChatMessage(@DestinationVariable String roomId, @Payload ChatMessage message) {
        messagingTemplate.convertAndSend("/topic/chat/" + roomId, message);
    }

    @MessageMapping("/typing/{roomId}")
    public void sendTypingEvent(@DestinationVariable String roomId, @Payload Map<String, String> payload) {
        messagingTemplate.convertAndSend("/topic/typing/" + roomId, payload);
    }

    // --- UPDATED: Now safely using CursorMessage instead of a generic Map ---
    @MessageMapping("/cursor/{roomId}")
    public void sendCursorEvent(@DestinationVariable String roomId, @Payload CursorMessage payload) {
        messagingTemplate.convertAndSend("/topic/cursor/" + roomId, payload);
    }

    @MessageMapping("/room/{roomId}/join")
    public void joinRoom(@DestinationVariable String roomId, @Payload UserMessage message, SimpMessageHeaderAccessor headerAccessor) {
        String username = message.getUsername();
        headerAccessor.getSessionAttributes().put("username", username);
        headerAccessor.getSessionAttributes().put("roomId", roomId);

        roomUsers.computeIfAbsent(roomId, k -> Collections.synchronizedSet(new HashSet<>())).add(username);
        
        logger.info("User {} joined Room {}", username, roomId);

        UserMessage response = new UserMessage(
            username, 
            new ArrayList<>(roomUsers.get(roomId)), 
            "JOIN"
        );
        messagingTemplate.convertAndSend("/topic/users/" + roomId, response);
    }

    @MessageMapping("/room/{roomId}/leave")
    public void leaveRoom(@DestinationVariable String roomId, @Payload UserMessage message) {
        String username = message.getUsername();
        
        if (roomUsers.containsKey(roomId)) {
            roomUsers.get(roomId).remove(username);
            logger.info("User {} left Room {}", username, roomId);
            
            UserMessage response = new UserMessage(
                username, 
                new ArrayList<>(roomUsers.get(roomId)), 
                "LEAVE"
            );
            messagingTemplate.convertAndSend("/topic/users/" + roomId, response);
        }
    }
}