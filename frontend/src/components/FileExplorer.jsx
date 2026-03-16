import React, { useState } from 'react';
import './FileExplorer.css';

// 1. The Recursive Node Component
const FileNode = ({ node, activeFile, onFileClick }) => {
    const [isOpen, setIsOpen] = useState(true);

    // If it's a file, render a clickable file item
    if (!node.isFolder) {
        return (
            <div
                className={`file-node ${activeFile === node.path ? 'active' : ''}`}
                onClick={() => onFileClick(node.path)}
                title={node.path}
            >
                <span className="file-icon">📄</span> {node.name}
            </div>
        );
    }

    // If it's a folder, render a toggleable directory and recurse into its children
    return (
        <div className="folder-node">
            <div className="folder-name" onClick={() => setIsOpen(!isOpen)}>
                <span className="folder-icon">{isOpen ? '📂' : '📁'}</span> {node.name}
            </div>
            
            {isOpen && (
                <div className="folder-children">
                    {Object.values(node.children).map(child => (
                        <FileNode
                            key={child.path}
                            node={child}
                            activeFile={activeFile}
                            onFileClick={onFileClick}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// 2. The Main File Explorer Component
const FileExplorer = ({ files, activeFile, onFileClick }) => {
    
    // Dynamically build a nested tree structure from the flat file paths
    const buildTree = () => {
        const tree = {};
        
        Object.keys(files).forEach(path => {
            const parts = path.split('/');
            let currentLevel = tree;
            
            parts.forEach((part, index) => {
                const isLast = index === parts.length - 1;
                const nodePath = parts.slice(0, index + 1).join('/');

                if (!currentLevel[part]) {
                    currentLevel[part] = {
                        name: part,
                        path: nodePath,
                        isFolder: !isLast,
                        children: {}
                    };
                }
                currentLevel = currentLevel[part].children;
            });
        });
        
        return tree;
    };

    const fileTree = buildTree();

    return (
        <div className="file-explorer-container">
            <div className="explorer-header">EXPLORER</div>
            <div className="file-tree">
                {Object.values(fileTree).map(node => (
                    <FileNode
                        key={node.path}
                        node={node}
                        activeFile={activeFile}
                        onFileClick={onFileClick}
                    />
                ))}
            </div>
        </div>
    );
};

export default FileExplorer;