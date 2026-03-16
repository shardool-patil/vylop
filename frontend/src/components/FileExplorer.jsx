import React, { useState } from 'react';
import { VscFolder, VscFolderOpened, VscMarkdown } from "react-icons/vsc";
import { DiJava, DiPython, DiJavascript1, DiGo } from "react-icons/di";
import { SiCplusplus, SiTypescript, SiRust } from "react-icons/si";
import { FiFile } from "react-icons/fi";
import './FileExplorer.css';

// Export this so we can reuse it in the CodeEditor tabs!
export const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    switch(ext) {
        case 'java': return <DiJava color="#b07219" size={18} />;
        case 'py': return <DiPython color="#3572A5" size={18} />;
        case 'cpp': 
        case 'c': 
        case 'h': return <SiCplusplus color="#f34b7d" size={16} />;
        case 'js': return <DiJavascript1 color="#f1e05a" size={18} />;
        case 'ts': return <SiTypescript color="#2b7489" size={16} />;
        case 'go': return <DiGo color="#00ADD8" size={18} />;
        case 'rs': return <SiRust color="#dea584" size={16} />;
        case 'md': return <VscMarkdown color="#58a6ff" size={16} />;
        default: return <FiFile color="#8b949e" size={16} />;
    }
};

const FileNode = ({ node, activeFile, onFileClick }) => {
    const [isOpen, setIsOpen] = useState(true);

    if (!node.isFolder) {
        return (
            <div
                className={`file-node ${activeFile === node.path ? 'active' : ''}`}
                onClick={() => onFileClick(node.path)}
                title={node.path}
            >
                <span className="file-icon" style={{display: 'flex', alignItems: 'center'}}>
                    {getFileIcon(node.name)}
                </span> 
                {node.name}
            </div>
        );
    }

    return (
        <div className="folder-node">
            <div className="folder-name" onClick={() => setIsOpen(!isOpen)}>
                <span className="folder-icon" style={{display: 'flex', alignItems: 'center'}}>
                    {isOpen ? <VscFolderOpened color="#dcb67a" size={16}/> : <VscFolder color="#dcb67a" size={16}/>}
                </span> 
                {node.name}
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

const FileExplorer = ({ files, activeFile, onFileClick }) => {
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