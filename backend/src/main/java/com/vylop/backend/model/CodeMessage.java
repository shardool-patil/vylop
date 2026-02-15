package com.vylop.backend.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CodeMessage {
    private String sender;
    private String content;
    private String language; // ✅ This field MUST exist
    private String type;
}