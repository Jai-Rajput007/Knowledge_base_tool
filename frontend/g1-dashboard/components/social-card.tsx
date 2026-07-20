"use client";

import React from 'react';
import { FaYoutube, FaFacebookF, FaInstagram } from 'react-icons/fa';
import { SiGmail } from 'react-icons/si';

export function SocialCard() {
  const socials = [
    {
      name: 'YouTube',
      icon: FaYoutube,
      color: 'bg-[#ff0000]',
      href: '#'
    },
    {
      name: 'Facebook',
      icon: FaFacebookF,
      color: 'bg-[#1877f2]',
      href: '#'
    },
    {
      name: 'Instagram',
      icon: FaInstagram,
      color: 'bg-[#e1306c]', // Reddish pink
      href: '#'
    },
    {
      name: 'Gmail',
      icon: SiGmail,
      color: 'bg-[#34a853]', // Green as requested
      href: '#'
    }
  ];

  return (
    <ul className="flex justify-center items-center gap-5 m-0 p-0 list-none">
      {socials.map((social) => (
        <li key={social.name} className="relative group flex justify-center items-center">
          <a
            href={social.href}
            aria-label={social.name}
            className="relative overflow-hidden flex justify-center items-center w-[50px] h-[50px] rounded-full bg-card border border-border text-muted-foreground shadow-sm transition-all duration-300 group-hover:shadow-[0_4px_15px_rgba(0,0,0,0.1)] group-hover:border-transparent group-hover:text-white z-10"
          >
            {/* The rising fill background */}
            <div
              className={`absolute bottom-0 left-0 w-full h-0 transition-all duration-300 ease-in-out group-hover:h-full z-0 ${social.color}`}
            />
            {/* The Icon */}
            <social.icon className="relative z-10 w-6 h-6 transition-colors duration-300" strokeWidth={1.5} />
          </a>
          
          {/* Tooltip */}
          <div
            className={`absolute -top-6 left-1/2 -translate-x-1/2 text-white px-2.5 py-1 rounded text-[13px] font-medium opacity-0 invisible group-hover:opacity-100 group-hover:visible group-hover:-top-10 transition-all duration-300 z-20 whitespace-nowrap shadow-md ${social.color}`}
          >
            {social.name}
          </div>
        </li>
      ))}
    </ul>
  );
}
