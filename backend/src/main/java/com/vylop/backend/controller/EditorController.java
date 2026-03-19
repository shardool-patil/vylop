package com.vylop.backend.controller;

import com.vylop.backend.model.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Controller
public class EditorController {

    private static final Logger logger = LoggerFactory.getLogger(EditorController.class);
    private final SimpMessagingTemplate messagingTemplate;
    
    private static final Map<String, Map<String, RoomParticipant>> roomUsers = new ConcurrentHashMap<>();

    public EditorController(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public static Map<String, Map<String, RoomParticipant>> getRoomUsers() {
        return roomUsers;
    }

    @MessageMapping("/code/{roomId}")
    public void sendCode(@DestinationVariable String roomId, @Payload CodeMessage message) {
        messagingTemplate.convertAndSend("/topic/code/" + roomId, message);
    }

    // --- FIXED: Accept raw String to prevent Jackson JSON corruption ---
    @MessageMapping("/yjs/{roomId}")
    public void sendYjsUpdate(@DestinationVariable String roomId, @Payload String payload) {
        // Relaying the exact raw JSON string skips any Java Map/Object conversion errors
        messagingTemplate.convertAndSend("/topic/yjs/" + roomId, payload);
    }

    @MessageMapping("/chat/{roomId}")
    public void sendChatMessage(@DestinationVariable String roomId, @Payload ChatMessage message) {
        messagingTemplate.convertAndSend("/topic/chat/" + roomId, message);
    }

    @MessageMapping("/typing/{roomId}")
    public void sendTypingEvent(@DestinationVariable String roomId, @Payload Map<String, String> payload) {
        messagingTemplate.convertAndSend("/topic/typing/" + roomId, payload);
    }

    @MessageMapping("/cursor/{roomId}")
    public void sendCursorEvent(@DestinationVariable String roomId, @Payload CursorMessage payload) {
        messagingTemplate.convertAndSend("/topic/cursor/" + roomId, payload);
    }

    @MessageMapping("/room/{roomId}/join")
    public void joinRoom(@DestinationVariable String roomId, @Payload UserMessage message, SimpMessageHeaderAccessor headerAccessor) {
        String username = message.getUsername();
        headerAccessor.getSessionAttributes().put("username", username);
        headerAccessor.getSessionAttributes().put("roomId", roomId);

        Map<String, RoomParticipant> usersInRoom = roomUsers.computeIfAbsent(roomId, k -> new ConcurrentHashMap<>());
        
        ParticipantRole assignedRole = usersInRoom.isEmpty() ? ParticipantRole.HOST : ParticipantRole.READ_ONLY;
        usersInRoom.put(username, new RoomParticipant(username, assignedRole));
        
        logger.info("User {} joined Room {} as {}", username, roomId, assignedRole);

        UserMessage response = new UserMessage(
            username, 
            new ArrayList<>(usersInRoom.values()), 
            "JOIN"
        );
        messagingTemplate.convertAndSend("/topic/users/" + roomId, response);
    }

    @MessageMapping("/room/{roomId}/leave")
    public void leaveRoom(@DestinationVariable String roomId, @Payload UserMessage message) {
        handleUserLeave(roomId, message.getUsername());
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.wrap(event.getMessage());
        String username = (String) headers.getSessionAttributes().get("username");
        String roomId = (String) headers.getSessionAttributes().get("roomId");

        if (username != null && roomId != null) {
            logger.info("Socket disconnected. Removing User {} from Room {}", username, roomId);
            handleUserLeave(roomId, username);
        }
    }

    private void handleUserLeave(String roomId, String username) {
        Map<String, RoomParticipant> usersInRoom = roomUsers.get(roomId);
        if (usersInRoom != null && usersInRoom.containsKey(username)) {
            RoomParticipant leavingUser = usersInRoom.remove(username);
            
            if (!usersInRoom.isEmpty() && leavingUser.getRole() == ParticipantRole.HOST) {
                RoomParticipant nextHost = usersInRoom.values().iterator().next();
                nextHost.setRole(ParticipantRole.HOST);
                logger.info("Host left. Promoted {} to new HOST in Room {}", nextHost.getUsername(), roomId);
            }

            UserMessage response = new UserMessage(
                username, 
                new ArrayList<>(usersInRoom.values()), 
                "LEAVE"
            );
            messagingTemplate.convertAndSend("/topic/users/" + roomId, response);
        }
    }

    @MessageMapping("/room/{roomId}/roleChange")
    public void changeRole(@DestinationVariable String roomId, @Payload Map<String, String> payload, SimpMessageHeaderAccessor headerAccessor) {
        String requester = (String) headerAccessor.getSessionAttributes().get("username");
        String targetUser = payload.get("targetUser");
        String newRoleStr = payload.get("newRole");

        Map<String, RoomParticipant> usersInRoom = roomUsers.get(roomId);
        
        if (usersInRoom != null && usersInRoom.containsKey(requester) && usersInRoom.get(requester).getRole() == ParticipantRole.HOST) {
            if (usersInRoom.containsKey(targetUser)) {
                usersInRoom.get(targetUser).setRole(ParticipantRole.valueOf(newRoleStr));
                
                logger.info("Host {} changed {}'s role to {}", requester, targetUser, newRoleStr);
                
                UserMessage response = new UserMessage(
                    targetUser, 
                    new ArrayList<>(usersInRoom.values()), 
                    "ROLE_UPDATE"
                );
                messagingTemplate.convertAndSend("/topic/users/" + roomId, response);
            }
        }
    }

    @MessageMapping("/room/{roomId}/kick")
    public void kickUser(@DestinationVariable String roomId, @Payload Map<String, String> payload, SimpMessageHeaderAccessor headerAccessor) {
        String requester = (String) headerAccessor.getSessionAttributes().get("username");
        String targetUser = payload.get("targetUser");

        Map<String, RoomParticipant> usersInRoom = roomUsers.get(roomId);
        
        if (usersInRoom != null && usersInRoom.containsKey(requester) && usersInRoom.get(requester).getRole() == ParticipantRole.HOST) {
            if (usersInRoom.containsKey(targetUser)) {
                usersInRoom.remove(targetUser);
                
                UserMessage response = new UserMessage(
                    targetUser, 
                    new ArrayList<>(usersInRoom.values()), 
                    "KICK"
                );
                messagingTemplate.convertAndSend("/topic/users/" + roomId, response);
            }
        }
    }
}