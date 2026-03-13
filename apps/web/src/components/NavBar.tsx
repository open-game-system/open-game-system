import { useState, useEffect } from 'react';
import { Menu, X, Github } from 'lucide-react';
import { Button } from "@/components/ui/button";
import ThemeToggle from './ThemeToggle';
import NavBarLogo from './NavBarLogo';

const NavBar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled ? 'bg-background/80 backdrop-blur-md shadow-sm' : ''
    }`}>
      <div className="container flex justify-between items-center py-4">
        <a href="/" className="flex items-center space-x-2">
          <span className="font-orbitron text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-ogs-purple to-ogs-light-purple">
            OGS
          </span>
        </a>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          <a href="/#about" className="text-sm font-medium hover:text-primary transition-colors">
            What is OGS?
          </a>
          <a href="/#components" className="text-sm font-medium hover:text-primary transition-colors">
            Core Components
          </a>
          <a href="/#ogs-app" className="text-sm font-medium hover:text-primary transition-colors">
            OGS Apps
          </a>
          <a href="/#how-it-works" className="text-sm font-medium hover:text-primary transition-colors">
            How It Works
          </a>
          <a href="/#protocol-examples" className="text-sm font-medium hover:text-primary transition-colors">
            SDK Integration
          </a>
          <a href="/#get-started" className="text-sm font-medium hover:text-primary transition-colors">
            Get Started
          </a>
          <a href="/#faq" className="text-sm font-medium hover:text-primary transition-colors">
            FAQ
          </a>
          <a href="/collective" className="text-sm font-medium hover:text-primary transition-colors">
            Collective
          </a>
          <ThemeToggle />
          <Button asChild className="bg-primary hover:bg-primary/90">
            <a href="https://github.com/open-game-system" target="_blank" rel="noopener noreferrer">
              <Github className="mr-2 h-4 w-4" />
              GitHub
            </a>
          </Button>
        </nav>

        {/* Mobile Navigation */}
        <div className="flex items-center space-x-4 md:hidden">
          <ThemeToggle />
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-background border-b border-border animate-fade-in">
          <nav className="container flex flex-col space-y-4 py-6">
            <a 
              href="/#about" 
              className="text-base font-medium hover:text-primary transition-colors py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              What is OGS?
            </a>
            <a 
              href="/#components" 
              className="text-base font-medium hover:text-primary transition-colors py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              Core Components
            </a>
            <a 
              href="/#ogs-app" 
              className="text-base font-medium hover:text-primary transition-colors py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              OGS Apps
            </a>
            <a 
              href="/#how-it-works" 
              className="text-base font-medium hover:text-primary transition-colors py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              How It Works
            </a>
            <a 
              href="/#protocol-examples" 
              className="text-base font-medium hover:text-primary transition-colors py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              SDK Integration
            </a>
            <a 
              href="/#get-started" 
              className="text-base font-medium hover:text-primary transition-colors py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              Get Started
            </a>
            <a 
              href="/#faq" 
              className="text-base font-medium hover:text-primary transition-colors py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              FAQ
            </a>
            <a 
              href="/collective" 
              className="text-base font-medium hover:text-primary transition-colors py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              Collective
            </a>
            <Button asChild className="bg-primary hover:bg-primary/90 w-full">
              <a href="https://github.com/open-game-system" target="_blank" rel="noopener noreferrer">
                <Github className="mr-2 h-4 w-4" />
                GitHub
              </a>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
};

export default NavBar;
