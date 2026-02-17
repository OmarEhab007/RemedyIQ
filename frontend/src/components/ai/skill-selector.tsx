"use client";

import type { Skill } from "@/lib/ai-types";
import { cn } from "@/lib/utils";

interface SkillSelectorProps {
  skills: Skill[];
  selected: string;
  onSelect: (name: string) => void;
}

const skillDescriptions: Record<string, string> = {
  auto: "Automatically choose the best skill based on your question",
  performance: "Analyze slow operations and latency issues",
  root_cause: "Find correlations and cascading failures",
  error_explainer: "Explain error codes and exceptions",
  anomaly_narrator: "Detect unusual patterns in your logs",
  summarizer: "Generate overview summaries of your analysis",
  nl_query: "General natural language queries",
};

export function SkillSelector({ skills, selected, onSelect }: SkillSelectorProps) {
  const autoOption = { name: "auto", description: skillDescriptions.auto };

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground uppercase">AI Skill</h4>
      <div className="space-y-1">
        <button
          onClick={() => onSelect("auto")}
          className={cn(
            "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
            selected === "auto"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted border border-transparent"
          )}
        >
          <div className="font-medium flex items-center gap-2">
            Auto
            <span className="text-xs opacity-70 font-normal">(recommended)</span>
          </div>
          <div className={cn("text-xs mt-0.5", selected === "auto" ? "text-primary-foreground/80" : "text-muted-foreground")}>
            {autoOption.description}
          </div>
        </button>

        {skills.map((skill) => (
          <button
            key={skill.name}
            onClick={() => onSelect(skill.name)}
            className={cn(
              "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
              selected === skill.name
                ? "bg-primary/10 text-primary border border-primary/20"
                : "hover:bg-muted"
            )}
          >
            <div className="font-medium capitalize">{skill.name.replace(/_/g, " ")}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {skillDescriptions[skill.name] || skill.description}
            </div>
            {skill.keywords && skill.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {skill.keywords.slice(0, 3).map((kw) => (
                  <span key={kw} className="text-[10px] px-1.5 py-0.5 bg-muted rounded">
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
