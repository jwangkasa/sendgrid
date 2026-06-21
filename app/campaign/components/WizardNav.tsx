'use client';

import type { WizardStep } from '@/lib/types';
import { CheckIcon } from 'lucide-react';

const STEPS: { id: WizardStep; label: string; description: string }[] = [
  { id: 'ingestion', label: 'Upload Recipients',  description: 'Import .xlsx file'       },
  { id: 'compose',   label: 'Compose Template',   description: 'Subject & HTML body'     },
  { id: 'preview',   label: 'Preview & Dispatch', description: 'Review & send campaign'  },
];

interface WizardNavProps {
  currentStep: WizardStep;
  completedSteps: Set<WizardStep>;
  onStepClick: (step: WizardStep) => void;
}

export function WizardNav({ currentStep, completedSteps, onStepClick }: WizardNavProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <nav aria-label="Campaign wizard steps" className="w-full">
      <ol className="flex items-start gap-0">
        {STEPS.map((step, index) => {
          const isCompleted = completedSteps.has(step.id);
          const isCurrent   = step.id === currentStep;
          const isClickable = isCompleted || index <= currentIndex;

          return (
            <li key={step.id} className="flex items-start flex-1 min-w-0">
              {/* Step item */}
              <button
                onClick={() => isClickable && onStepClick(step.id)}
                disabled={!isClickable}
                className="flex flex-col items-center gap-2 w-full group disabled:cursor-default"
                aria-current={isCurrent ? 'step' : undefined}
              >
                {/* Circle + connector row */}
                <div className="flex items-center w-full">
                  {/* Left connector (hidden for first step) */}
                  {index > 0 && (
                    <div
                      className={`flex-1 h-0.5 transition-colors ${
                        index <= currentIndex ? 'bg-brand-600' : 'bg-gray-200'
                      }`}
                    />
                  )}

                  {/* Circle */}
                  <div
                    className={`
                      w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0
                      border-2 transition-all duration-200 font-semibold text-sm
                      ${isCompleted
                        ? 'bg-brand-600 border-brand-600 text-white'
                        : isCurrent
                          ? 'bg-white border-brand-500 text-brand-600 ring-4 ring-brand-100'
                          : 'bg-white border-gray-300 text-gray-400'
                      }
                      ${isClickable && !isCurrent ? 'group-hover:border-brand-400 group-hover:text-brand-500' : ''}
                    `}
                  >
                    {isCompleted ? (
                      <CheckIcon className="w-4 h-4" strokeWidth={2.5} />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>

                  {/* Right connector (hidden for last step) */}
                  {index < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 transition-colors ${
                        index < currentIndex ? 'bg-brand-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>

                {/* Label + description */}
                <div className="text-center px-1">
                  <p
                    className={`text-xs font-semibold leading-tight transition-colors ${
                      isCurrent
                        ? 'text-brand-600'
                        : isCompleted
                          ? 'text-gray-700'
                          : 'text-gray-400'
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5 hidden sm:block">
                    {step.description}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
