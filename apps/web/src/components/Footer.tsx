import React from 'react';
import { Github, Mail, Globe, Twitter, MessageSquare } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-secondary py-12 mt-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <h3 className="font-orbitron text-lg font-bold">Open Game System</h3>
            <p className="text-muted-foreground text-sm">
              Bridge web games to native features with ease.
            </p>
            <div className="flex space-x-4">
              <a href="https://github.com/open-game-system" className="text-muted-foreground hover:text-primary transition-colors" aria-label="GitHub" target="_blank" rel="noopener noreferrer">
                <Github className="h-5 w-5" />
              </a>
              <a href="https://twitter.com/OpenGameCo" className="text-muted-foreground hover:text-primary transition-colors" aria-label="Twitter" target="_blank" rel="noopener noreferrer">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="https://discord.gg/opengamesystem" className="text-muted-foreground hover:text-primary transition-colors" aria-label="Discord" target="_blank" rel="noopener noreferrer">
                <MessageSquare className="h-5 w-5" />
              </a>
              <a href="https://opengame.org" className="text-muted-foreground hover:text-primary transition-colors" aria-label="Website" target="_blank" rel="noopener noreferrer">
                <Globe className="h-5 w-5" />
              </a>
              <a href="mailto:hello@opengame.org" className="text-muted-foreground hover:text-primary transition-colors" aria-label="Email">
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold mb-4">Documentation</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="https://github.com/open-game-system/specification" className="text-muted-foreground hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer">
                  OGS Specification
                </a>
              </li>
              <li>
                <a href="https://github.com/open-game-system/auth-kit" className="text-muted-foreground hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer">
                  Auth Kit
                </a>
              </li>
              <li>
                <a href="https://github.com/open-game-system/notification-kit" className="text-muted-foreground hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer">
                  Notification Kit
                </a>
              </li>
              <li>
                <a href="https://github.com/open-game-system/cast-kit" className="text-muted-foreground hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer">
                  Cast Kit
                </a>
              </li>
              <li>
                <a href="#stream-kit-integration" className="text-muted-foreground hover:text-primary transition-colors">
                  Stream Kit (Conceptual)
                </a>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold mb-4">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="https://github.com/orgs/open-game-system/discussions" className="text-muted-foreground hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer">
                  Community
                </a>
              </li>
              <li>
                <a href="https://github.com/open-game-system" className="text-muted-foreground hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
              </li>
              <li>
                <a href="https://triviajam.tv" className="text-muted-foreground hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer">
                  Trivia Jam Demo
                </a>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="https://opengame.org" className="text-muted-foreground hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer">
                  Website
                </a>
              </li>
              <li>
                <a href="mailto:hello@opengame.org" className="text-muted-foreground hover:text-primary transition-colors">
                  Contact
                </a>
              </li>
              <li>
                <a href="https://github.com/open-game-system/specification" className="text-muted-foreground hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer">
                  Specification
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Open Game System. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
