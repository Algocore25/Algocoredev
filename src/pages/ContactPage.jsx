import React, { useState, useEffect } from 'react';
import { FaGithub, FaLinkedin, FaEnvelope } from 'react-icons/fa';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebase';

// Default avatar component
const DefaultAvatar = () => (
  <svg viewBox="0 0 200 200" className="w-32 h-32 mx-auto">
    <circle cx="100" cy="100" r="80" fill="#4F46E5" />
    <circle cx="100" cy="85" r="40" fill="#F3F4F6" />
    <circle cx="82" cy="80" r="5" fill="#374151" />
    <circle cx="118" cy="80" r="5" fill="#374151" />
    <path d="M80 120 Q100 140 120 120" stroke="#374151" strokeWidth="4" fill="none" />
  </svg>
);

// Component to render SVG from string
const SvgRenderer = ({ svgString, className = '' }) => {
  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={{ __html: svgString }}
    />
  );
};

const ContactCard = ({ member }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-transform duration-300 hover:scale-105">
    <div className="p-2">
      <div className="flex justify-center -mt-16">
        <div className="bg-white dark:bg-gray-700 p-1 rounded-full">
          {member.avatar}
        </div>
      </div>
      <div className="px-6 py-4 text-center">
        <h3 className="text-2xl font-semibold text-gray-800 dark:text-white">{member.name}</h3>
        <p className="text-indigo-600 dark:text-indigo-400 text-sm">{member.role}</p>
        <div className="flex justify-center space-x-4 mt-4">
          <a 
            href={member.linkedin} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            aria-label="LinkedIn"
          >
            <FaLinkedin size={24} />
          </a>
          <a 
            href={member.github} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
            aria-label="GitHub"
          >
            <FaGithub size={24} />
          </a>
          <a 
            href={`mailto:${member.email}`}
            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
            aria-label="Email"
          >
            <FaEnvelope size={24} />
          </a>
        </div>
      </div>
    </div>
  </div>
);

const ContactPage = () => {
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Background elements
  const backgroundElements = [
    { top: '20%', left: '10%', size: 'w-20 h-20', color: 'bg-blue-200' },
    { top: '40%', right: '10%', size: 'w-16 h-16', color: 'bg-purple-200' },
    { bottom: '40%', left: '15%', size: 'w-12 h-12', color: 'bg-green-200' },
    { bottom: '60%', right: '20%', size: 'w-24 h-24', color: 'bg-yellow-200' },
  ];

  useEffect(() => {
    const teamRef = ref(database, 'teamMembers');
    
    const processTeamMember = (member) => {
      // If avatar is an object with an svg property, use it
      if (member.avatar && typeof member.avatar === 'object' && member.avatar.svg) {
        return {
          ...member,
          avatar: <SvgRenderer 
            svgString={member.avatar.svg} 
            className="w-32 h-32 mx-auto"
          />
        };
      }
      // If avatar is a string, use it as SVG string
      if (member.avatar && typeof member.avatar === 'string') {
        return {
          ...member,
          avatar: <SvgRenderer 
            svgString={member.avatar} 
            className="w-32 h-32 mx-auto"
          />
        };
      }
      // Default avatar if none provided
      return {
        ...member,
        avatar: <DefaultAvatar />
      };
    };
    
    const unsubscribe = onValue(teamRef, (snapshot) => {
      try {
        const data = snapshot.val();
        if (data) {
          // Convert the object of team members to an array and process each member
          const membersArray = Object.entries(data).map(([id, member]) => ({
            id,
            ...processTeamMember(member)
          }));
          setTeamMembers(membersArray);
        } else {
          setTeamMembers([]);
        }
        setError(null);
      } catch (err) {
        console.error('Error fetching team members:', err);
        setError('Failed to load team members. Please try again later.');
        setTeamMembers([]);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error('Firebase error:', error);
      setError('Error connecting to the server. Please check your connection.');
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading team members...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center p-6 max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">Oops! Something went wrong</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Grid Pattern Background */}
      {/* <div className="absolute top-0 left-0 w-full h-full bg-grid-pattern dark:bg-dark-grid-pattern bg-20"></div> */}
      
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {backgroundElements.map((element, index) => (
          <div 
            key={index}
            className={`absolute ${element.top} ${element.left || ''} ${element.right || ''} 
                       ${element.size} ${element.color} rounded-full opacity-20 animate-pulse`}
            style={{
              animationDelay: `${index * 2}s`,
              animationDuration: '8s'
            }}
          ></div>
        ))}
      </div>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Meet Our Team
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            We're a passionate team dedicated to making learning algorithms fun and accessible.
          </p>
        </div>
        
        {teamMembers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {teamMembers.map((member) => (
              <ContactCard key={member.id} member={{
                ...member,
                // Use default avatar if none provided
                avatar: member.avatar || <DefaultAvatar />
              }} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow">
            <p className="text-gray-500 dark:text-gray-400">No team members found.</p>
          </div>
        )}

       
      </div>
    </div>
  );
};

export default ContactPage;
