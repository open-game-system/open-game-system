import React from 'react';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import { Github, Mail, Code, Rocket, PuzzleIcon, Users, Globe, Zap, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import OGSLogo from '@/components/OGSLogo';

interface Member {
  username: string;
}

const Collective = () => {
  const members: Member[] = [
    {
      username: 'jonmumm',
    },
    {
      username: 'fravic',
    },
    {
      username: 'octanebaby',
    },
    // Room for more contributors to be added here
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      
      <main className="flex-grow pt-24">
        <section className="container px-4 py-16 mx-auto">
          <div className="max-w-4xl mx-auto text-center">
            <div className="w-32 h-32 mx-auto mb-6">
              <img 
                src="/logo.svg" 
                alt="Open Game Collective Logo" 
                className="w-full h-full"
              />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold font-orbitron mb-6 text-foreground">
              Open Game Collective
            </h1>
            <p className="text-xl mb-6 text-foreground">
              A small group of open source developers dedicated to advancing and maintaining open technologies for web gaming
            </p>
            
            <div className="flex flex-col items-center justify-center mb-8">
              <span className="text-lg mb-3 text-foreground">Publishers of</span>
              <div className="w-32 h-32">
                <OGSLogo />
              </div>
            </div>
            
            <div className="flex justify-center gap-4 mb-16">
              <Button asChild className="bg-primary hover:bg-primary/90">
                <a href="https://github.com/open-game-system" target="_blank" rel="noopener noreferrer">
                  <Github className="mr-2 h-4 w-4" />
                  GitHub Organization
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="mailto:hello@opengame.org">
                  <Mail className="mr-2 h-4 w-4" />
                  Contact Us
                </a>
              </Button>
            </div>
          </div>

          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">Our Mission</h2>
            <p className="text-lg mb-6 text-center text-foreground">
              To collaboratively develop and maintain open specifications, protocols, SDKs, and services 
              that empower developers and players, making rich gaming experiences more accessible 
              and decentralized across the web and native platforms.
            </p>
            <div className="bg-card border border-border rounded-lg p-8 mb-12">
              <h3 className="text-xl font-bold mb-4 text-center">Our Approach: Open Protocols for Accessible Gaming</h3>
              <p className="text-foreground mb-4">
                We believe in building upon the open web. Our protocols offer standardized ways 
                to progressively enhance web games with capabilities previously locked behind 
                proprietary platforms, fostering innovation and accessibility.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="border border-border rounded-lg p-4 flex items-start">
                  <div className="mr-3 mt-1 bg-primary/10 p-2 rounded-full text-primary">
                    <Globe className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold mb-2">Foundation on Web Standards</h4>
                    <p className="text-sm text-foreground">
                      Games remain fundamentally web applications. OGS provides open protocols to optionally 
                      integrate features like notifications, casting, or cloud streaming via standardized interfaces.
                    </p>
                  </div>
                </div>
                
                <div className="border border-border rounded-lg p-4 flex items-start">
                  <div className="mr-3 mt-1 bg-primary/10 p-2 rounded-full text-primary">
                    <Rocket className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold mb-2">Advanced Capabilities via Protocols</h4>
                    <p className="text-sm text-foreground">
                      Our protocols, like the `stream-kit` specification, define how to deliver advanced experiences, such as cloud-rendering RTX 3080-level graphics 
                      to any device, ensuring interoperability and openness.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-center">
                <Zap className="h-5 w-5 text-primary mr-2" />
                <p className="text-foreground">
                  Write your game once for the web, and it automatically works with native features.
                </p>
              </div>
            </div>

            <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">Pricing & Costs</h2>
            <div className="bg-card border border-border rounded-lg p-8 mb-16">
              <div className="mb-8">
                <h3 className="text-xl font-bold mb-3">Free Tier for Indie Developers</h3>
                <p className="text-foreground mb-4">
                  The Open Game Collective offers a completely free tier for indie developers and small studios.
                  This includes basic access to notifications, which are relatively inexpensive and subsidized by the collective.
                </p>
                <div className="bg-secondary/30 p-4 rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center">
                    <Rocket className="h-5 w-5 text-primary mr-2" />
                    Benefits Beyond the Free Services
                  </h4>
                  <ul className="list-none space-y-3 text-sm text-foreground">
                    <li className="flex items-start">
                      <span className="inline-block mr-2 text-primary">✓</span>
                      <span><span className="font-medium">Skip app store review processes</span> — Launch immediately without waiting for approval</span>
                    </li>
                    <li className="flex items-start">
                      <span className="inline-block mr-2 text-primary">✓</span>
                      <span><span className="font-medium">Avoid platform fees</span> — No 30% cut from app stores on your revenue</span>
                    </li>
                    <li className="flex items-start">
                      <span className="inline-block mr-2 text-primary">✓</span>
                      <span><span className="font-medium">Single codebase</span> — Maintain one web-based codebase that works everywhere</span>
                    </li>
                    <li className="flex items-start">
                      <span className="inline-block mr-2 text-primary">✓</span>
                      <span><span className="font-medium">Faster iterations</span> — Update your game instantly without resubmission</span>
                    </li>
                  </ul>
                </div>
              </div>
              
              <div className="mb-8">
                <h3 className="text-xl font-bold mb-3">Transparent Cost Structure</h3>
                <p className="text-foreground mb-4">
                  For larger projects, costs are primarily associated with:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-foreground mb-4">
                  <li><span className="font-medium">Rendering servers</span> — The computing resources required to run your game logic on our servers</li>
                  <li><span className="font-medium">WebRTC streaming</span> — The bandwidth and infrastructure needed to stream content to Chromecast devices</li>
                </ul>
                <p className="text-foreground">
                  We believe in full transparency. The costs you pay directly reflect the actual infrastructure expenses
                  we incur to provide these services, without arbitrary markups. Your game is always hosted on your own domain.
                </p>
              </div>
              
              <div>
                <h3 className="text-xl font-bold mb-3">Custom Pricing Plans</h3>
                <p className="text-foreground mb-4">
                  For projects beyond the free tier, we work directly with you to develop a custom plan that:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-foreground mb-4">
                  <li>Matches your projected usage and scale</li>
                  <li>Provides predictable pricing based on your specific needs</li>
                  <li>Scales efficiently as your user base grows</li>
                </ul>
                <div className="flex justify-center mt-6">
                  <Button variant="outline" asChild>
                    <a href="mailto:hello@opengame.org">
                      <Mail className="mr-2 h-4 w-4" />
                      Contact Us for Custom Pricing
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">Core Team</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
              {members.map((member) => (
                <div 
                  key={member.username} 
                  className="flex flex-col items-center p-6 border border-border rounded-lg bg-card hover:shadow-md transition-shadow"
                >
                  <div className="w-28 h-28 mb-4 overflow-hidden rounded-full border-2 border-primary">
                    <img 
                      src={`https://github.com/${member.username}.png`} 
                      alt={`${member.username}'s avatar`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback if GitHub avatar can't be loaded
                        (e.target as HTMLImageElement).src = 'https://github.com/identicons/github.png';
                      }}
                    />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{member.username}</h3>
                  <Button variant="ghost" size="sm" asChild>
                    <a 
                      href={`https://github.com/${member.username}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center"
                    >
                      <Github className="mr-2 h-4 w-4" />
                      GitHub Profile
                    </a>
                  </Button>
                </div>
              ))}
            </div>

            <div className="bg-card border border-border rounded-lg p-8 mb-12">
              <h3 className="text-xl font-bold mb-6 text-center">Join The Collective</h3>
              <p className="text-center text-foreground mb-6">
                We're a small but dedicated group of developers working to create an open ecosystem for web games.
                If you're passionate about web gaming and open source, we'd love to have you join us!
              </p>
              
              <div className="flex flex-col md:flex-row items-center justify-center gap-4">
                <Button asChild className="w-full md:w-auto">
                  <a 
                    href="https://github.com/orgs/open-game-system/discussions" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center"
                  >
                    <Github className="mr-2 h-4 w-4" />
                    GitHub Discussions
                  </a>
                </Button>
                
                <Button asChild className="bg-primary/90 hover:bg-primary w-full md:w-auto">
                  <a href="https://discord.gg/opengamesystem" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Join Our Discord
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Collective; 