package com.vylop.backend.model;

public class CursorMessage {
    private String username;
    private int lineNumber;
    private int column;

    public CursorMessage() {
    }

    public CursorMessage(String username, int lineNumber, int column) {
        this.username = username;
        this.lineNumber = lineNumber;
        this.column = column;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public int getLineNumber() {
        return lineNumber;
    }

    public void setLineNumber(int lineNumber) {
        this.lineNumber = lineNumber;
    }

    public int getColumn() {
        return column;
    }

    public void setColumn(int column) {
        this.column = column;
    }
}