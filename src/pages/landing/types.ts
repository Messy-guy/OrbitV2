import React from 'react';

export interface CardItem {
  id: 'cli' | 'desktop' | 'app';
  accentClass: string;
  accentColor: string;
  title: string;
  subtitle: string;
  tag: string;
  detailTitle: string;
  detailSub: string;
  detailBtn: string;
  icon: React.ReactNode;
}

export interface EngineItem {
  id: string;
  name: string;
  tag: string;
  provider: string;
  badge: string;
  color: string;
  description: string;
  features: string[];
  operationalModes: ('Plan' | 'Code' | 'Audit')[];
  commandPreview: string;
}

export interface BentoFeatureItem {
  id: string;
  title: string;
  badge: string;
  description: string;
  colSpan?: string;
  accent: string;
  icon: React.ReactNode;
  previewElement?: React.ReactNode;
}

export interface ArchitectureStep {
  step: string;
  title: string;
  role: string;
  description: string;
  tagColor: string;
  terminalSnippet: string;
}
