import React from 'react';

// Define SDK types
type SDKType = 'auth' | 'notification' | 'cast';

interface SDKVisualProps {
  type: SDKType;
  className?: string;
}

const SDKVisual: React.FC<SDKVisualProps> = ({ type, className = '' }) => {
  const authKitContent = {
    emoji: '🔐',
    title: 'Auth-Kit',
    description: 'Connect your game to the OGS ecosystem',
    features: [
      { emoji: '👤', text: 'Link player accounts between your game and OGS' },
      { emoji: '🔄', text: 'Easy OAuth-style authorization flow' },
      { emoji: '🌐', text: 'Works across all platforms and devices' }
    ],
    benefits: [
      { emoji: '🛡️', text: 'Secure authentication process' },
      { emoji: '⚡', text: 'Minimal integration effort' },
      { emoji: '🧩', text: 'Foundation for all other OGS features' }
    ]
  };

  const notificationKitContent = {
    emoji: '🔔',
    title: 'Notification-Kit',
    description: 'Keep players engaged even when they\'re not actively playing',
    features: [
      { emoji: '📱', text: 'Send push notifications to users\' devices' },
      { emoji: '🎯', text: 'Target specific player segments' },
      { emoji: '🔗', text: 'Deep linking back to your game' }
    ],
    benefits: [
      { emoji: '🔄', text: 'Increase player retention and engagement' },
      { emoji: '⏰', text: 'Schedule notifications for optimal timing' },
      { emoji: '📊', text: 'Track delivery and interaction analytics' }
    ]
  };

  const castKitContent = {
    emoji: '📺',
    title: 'Cast-Kit',
    description: 'Bring your games to the big screen',
    features: [
      { emoji: '📲', text: 'Cast game to TVs while using phones as controllers' },
      { emoji: '🎮', text: 'Create multi-device experiences' },
      { emoji: '🔌', text: 'Simple connection protocol' }
    ],
    benefits: [
      { emoji: '👪', text: 'Enable social and party play experiences' },
      { emoji: '🚀', text: 'No need for dedicated console hardware' },
      { emoji: '🎭', text: 'Separate UI for TV and controller devices' }
    ]
  };

  const getContent = () => {
    switch (type) {
      case 'auth': return authKitContent;
      case 'notification': return notificationKitContent;
      case 'cast': return castKitContent;
      default: return authKitContent;
    }
  };

  const content = getContent();

  return (
    <div className={`${className} rounded-lg bg-gradient-to-br from-ogs-purple/10 to-primary/5 p-6`}>
      <div className="flex flex-col">
        <div className="flex items-center justify-center mb-4">
          <span className="text-4xl mr-3" role="img" aria-label={content.title}>
            {content.emoji}
          </span>
          <h3 className="text-xl font-bold text-ogs-purple">{content.title}</h3>
        </div>
        
        <p className="text-center mb-4 text-muted-foreground">{content.description}</p>
        
        <div className="grid grid-cols-1 gap-4">
          <div>
            <h4 className="font-semibold text-primary text-sm mb-2">Key Features</h4>
            <ul className="space-y-2">
              {content.features.map((feature, index) => (
                <li key={`feature-${index}`} className="flex items-start">
                  <span className="mr-2" role="img" aria-hidden="true">
                    {feature.emoji}
                  </span>
                  <span className="text-sm">{feature.text}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-primary text-sm mb-2">Benefits</h4>
            <ul className="space-y-2">
              {content.benefits.map((benefit, index) => (
                <li key={`benefit-${index}`} className="flex items-start">
                  <span className="mr-2" role="img" aria-hidden="true">
                    {benefit.emoji}
                  </span>
                  <span className="text-sm">{benefit.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SDKVisual; 