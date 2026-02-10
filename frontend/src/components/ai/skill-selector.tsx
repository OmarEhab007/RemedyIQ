"use client";

import type { SkillInfo } from "@/hooks/use-ai";

interface SkillSelectorProps {
  skills: SkillInfo[];
  selected: string;
  onSelect: (name: string) => void;
}

export function SkillSelector({ skills, selected, onSelect }: SkillSelectorProps) {
  if (skills.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground uppercase">AI Skill</h4>
      <div className="space-y-1">
        {skills.map((skill) => (
          <button
            key={skill.name}
            onClick={() => onSelect(skill.name)}
            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
              selected === skill.name
                ? "bg-primary/10 text-primary border border-primary/20"
                : "hover:bg-muted"
            }`}
          >
            <div className="font-medium">{skill.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{skill.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
