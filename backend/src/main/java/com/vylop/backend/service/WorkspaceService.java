package com.vylop.backend.service;

import com.vylop.backend.model.Room;
import com.vylop.backend.model.RoomFile;
import com.vylop.backend.model.User;
import com.vylop.backend.repository.RoomFileRepository;
import com.vylop.backend.repository.RoomRepository;
import com.vylop.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class WorkspaceService {

    private final RoomRepository roomRepository;
    private final RoomFileRepository roomFileRepository;
    private final UserRepository userRepository;

    public WorkspaceService(RoomRepository roomRepository, RoomFileRepository roomFileRepository, UserRepository userRepository) {
        this.roomRepository = roomRepository;
        this.roomFileRepository = roomFileRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public String saveWorkspace(UUID roomId, String username, String roomName, Map<String, String> files) {
        Optional<User> userOpt = userRepository.findByUsername(username);
        if (userOpt.isEmpty()) return "Error: User not found!";
        User user = userOpt.get();

        Room room = roomRepository.findById(roomId).orElseGet(() -> {
            Room newRoom = new Room(roomName, user, false);
            newRoom.setId(roomId);
            return roomRepository.save(newRoom);
        });

        for (Map.Entry<String, String> entry : files.entrySet()) {
            String fileName = entry.getKey();
            String content = entry.getValue();
            String language = determineLanguage(fileName); 

            Optional<RoomFile> existingFile = roomFileRepository.findByRoomIdAndFileName(roomId, fileName);
            
            if (existingFile.isPresent()) {
                RoomFile file = existingFile.get();
                file.setContent(content);
                roomFileRepository.save(file);
            } else {
                RoomFile newFile = new RoomFile(room, fileName, content, language);
                roomFileRepository.save(newFile);
            }
        }
        return "Workspace saved successfully!";
    }

    public Map<String, String> loadWorkspace(UUID roomId) {
        List<RoomFile> files = roomFileRepository.findByRoomId(roomId);
        return files.stream().collect(Collectors.toMap(RoomFile::getFileName, RoomFile::getContent));
    }

    public List<Map<String, Object>> getUserWorkspaces(String username) {
        List<Room> rooms = roomRepository.findByHostUsernameOrderByCreatedAtDesc(username);
        
        return rooms.stream().map(room -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", room.getId());
            map.put("name", room.getName());
            map.put("createdAt", room.getCreatedAt());
            return map;
        }).collect(Collectors.toList());
    }

    // --- NEW: Safe cascading delete function ---
    @Transactional
    public String deleteWorkspace(UUID roomId, String username) {
        Optional<Room> roomOpt = roomRepository.findById(roomId);
        if (roomOpt.isEmpty()) return "Error: Workspace not found.";
        
        Room room = roomOpt.get();
        
        // Security check: Only the owner can delete the room
        if (!room.getHost().getUsername().equals(username)) {
            return "Error: Unauthorized. Only the host can delete this workspace.";
        }

        // 1. Delete all files inside the room first
        List<RoomFile> files = roomFileRepository.findByRoomId(roomId);
        roomFileRepository.deleteAll(files);
        
        // 2. Delete the empty room
        roomRepository.delete(room);
        
        return "Workspace deleted successfully.";
    }

    private String determineLanguage(String fileName) {
        if (fileName.endsWith(".java")) return "java";
        if (fileName.endsWith(".py")) return "python";
        if (fileName.endsWith(".cpp")) return "cpp";
        if (fileName.endsWith(".js")) return "javascript";
        if (fileName.endsWith(".go")) return "go";
        return "plaintext";
    }
}