'use client'

import { useState, useMemo } from 'react'
import type { UsageData } from '@/lib/parse-logs'
import { analyzePersonality, type PersonalityProfile, type BigFiveProfile } from '@/lib/personality'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Copy, Check, Brain, Target, Sparkles, ArrowRight } from 'lucide-react'

const TASK_OPTIONS = [
  { value: 'frontendDev', label: 'Frontend Development' },
  { value: 'backendDev', label: 'Backend Development' },
  { value: 'dataEngineering', label: 'Data Engineering' },
  { value: 'devOps', label: 'DevOps' },
  { value: 'debugging', label: 'Debugging' },
  { value: 'refactoring', label: 'Refactoring' },
]

const MBTI_DESCRIPTIONS: Record<string, string> = {
  ISTJ: 'The Inspector — Methodical, detail-oriented, follows established procedures',
  ISFJ: 'The Protector — Supportive, reliable, focused on preserving working code',
  INFJ: 'The Counselor — Insightful, sees patterns, anticipates architectural needs',
  INTJ: 'The Architect — Strategic, independent, designs for long-term quality',
  ISTP: 'The Craftsman — Practical, efficient, excels at targeted fixes',
  ISFP: 'The Composer — Adaptable, aesthetic sense, good at UI refinement',
  INFP: 'The Healer — Idealistic, explores creative solutions, values code clarity',
  INTP: 'The Thinker — Analytical, explores edge cases, values logical consistency',
  ESTP: 'The Dynamo — Action-oriented, quick iterations, bias toward execution',
  ESFP: 'The Performer — Energetic, responsive, generates many alternatives',
  ENFP: 'The Champion — Enthusiastic explorer, broad tool usage, creative approaches',
  ENTP: 'The Visionary — Innovative, questions assumptions, proposes novel solutions',
  ESTJ: 'The Supervisor — Organized, efficient, follows project conventions strictly',
  ESFJ: 'The Provider — Cooperative, communicative, adapts to user preferences',
  ENFJ: 'The Teacher — Explains reasoning, mentors through code, proactive guidance',
  ENTJ: 'The Commander — Decisive, takes charge, designs comprehensive solutions',
}

function TraitBar({
  label,
  value,
  idealValue,
  color,
  leftLabel,
  rightLabel,
}: {
  label: string
  value: number
  idealValue?: number
  color: string
  leftLabel?: string
  rightLabel?: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{Math.round(value)}/100</span>
      </div>
      {(leftLabel || rightLabel) && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.max(2, value)}%`,
            backgroundColor: color,
          }}
        />
        {idealValue !== undefined && (
          <div
            className="absolute top-0 h-full w-0.5 bg-foreground/60"
            style={{ left: `${idealValue}%` }}
            title={`Ideal: ${Math.round(idealValue)}`}
          />
        )}
      </div>
    </div>
  )
}

function MBTIDimension({
  label,
  value,
  leftPole,
  rightPole,
}: {
  label: string
  value: number
  leftPole: string
  rightPole: string
}) {
  const normalized = (value + 100) / 2 // -100..+100 → 0..100
  const isLeft = value < 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className={`font-medium ${isLeft ? 'text-foreground' : 'text-muted-foreground'}`}>
          {leftPole}
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`font-medium ${!isLeft ? 'text-foreground' : 'text-muted-foreground'}`}>
          {rightPole}
        </span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
        <div className="absolute top-0 left-1/2 h-full w-px bg-foreground/20" />
        {isLeft ? (
          <div
            className="absolute top-0 right-1/2 h-full rounded-l-full transition-all duration-500"
            style={{ width: `${(100 - normalized)}%`, backgroundColor: 'var(--chart-1)' }}
          />
        ) : (
          <div
            className="absolute top-0 left-1/2 h-full rounded-r-full transition-all duration-500"
            style={{ width: `${normalized - 50}%`, backgroundColor: 'var(--chart-2)' }}
          />
        )}
      </div>
    </div>
  )
}

function FitScoreCard({ task, score, isSelected }: { task: string; score: number; isSelected: boolean }) {
  const taskNames: Record<string, string> = {
    frontendDev: 'Frontend',
    backendDev: 'Backend',
    dataEngineering: 'Data Eng',
    devOps: 'DevOps',
    debugging: 'Debug',
    refactoring: 'Refactor',
  }

  const getColor = (s: number) => {
    if (s >= 80) return 'text-foreground'
    if (s >= 60) return 'text-foreground'
    if (s >= 40) return 'text-muted-foreground'
    return 'text-muted-foreground'
  }

  const getBg = (s: number) => {
    if (s >= 80) return 'bg-chart-2/10'
    if (s >= 60) return 'bg-chart-1/10'
    if (s >= 40) return 'bg-chart-3/10'
    return 'bg-muted/50'
  }

  return (
    <div
      className={`rounded-lg border p-3 text-center transition-all ${
        isSelected ? 'border-chart-1 border-2' : ''
      } ${getBg(score)}`}
    >
      <div className="text-xs text-muted-foreground mb-1">{taskNames[task]}</div>
      <div className={`text-2xl font-bold ${getColor(score)}`}>{score}%</div>
    </div>
  )
}

export function PersonalityFit({ data }: { data: UsageData }) {
  const [targetTask, setTargetTask] = useState('backendDev')
  const targetTaskLabel = TASK_OPTIONS.find((t) => t.value === targetTask)?.label || targetTask
  const [copied, setCopied] = useState(false)

  const profile: PersonalityProfile = useMemo(
    () => analyzePersonality(data, targetTask),
    [data, targetTask]
  )

  const handleCopyPrompt = async () => {
    await navigator.clipboard.writeText(profile.systemPrompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const bigFiveColors: Record<keyof BigFiveProfile, string> = {
    openness: 'var(--chart-1)',
    conscientiousness: 'var(--chart-2)',
    extraversion: 'var(--chart-3)',
    agreeableness: 'var(--chart-4)',
    neuroticism: 'var(--chart-5)',
  }

  const idealProfile = {
    frontendDev: { openness: 80, conscientiousness: 60, extraversion: 70, agreeableness: 75, neuroticism: 20 },
    backendDev: { openness: 50, conscientiousness: 90, extraversion: 40, agreeableness: 60, neuroticism: 15 },
    dataEngineering: { openness: 45, conscientiousness: 95, extraversion: 35, agreeableness: 55, neuroticism: 10 },
    devOps: { openness: 55, conscientiousness: 85, extraversion: 50, agreeableness: 65, neuroticism: 15 },
    debugging: { openness: 70, conscientiousness: 80, extraversion: 55, agreeableness: 50, neuroticism: 25 },
    refactoring: { openness: 65, conscientiousness: 90, extraversion: 45, agreeableness: 70, neuroticism: 15 },
  }[targetTask] || { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, neuroticism: 50 }

  return (
    <div className="space-y-6">
      {/* MBTI type */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle>Agent Personality Type</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold tracking-wider text-primary">
              {profile.mbtiType}
            </div>
            <div className="text-sm text-muted-foreground">
              {MBTI_DESCRIPTIONS[profile.mbtiType] || 'Unique personality profile'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task Fit Scores */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Task Fit Scores</CardTitle>
              <CardDescription>
                How well the agent's observed personality matches ideal profiles for each task type
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Target Task</span>
              <Select value={targetTask} onValueChange={(v) => v && setTargetTask(v)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={targetTaskLabel}>{targetTaskLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {TASK_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {Object.entries(profile.fitScores).map(([task, score]) => (
              <FitScoreCard
                key={task}
                task={task}
                score={score}
                isSelected={task === targetTask}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Big Five and MBTI side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Big Five */}
        <Card>
          <CardHeader>
            <CardTitle>Big Five (OCEAN) Profile</CardTitle>
            <CardDescription>
              Derived from behavioral signals. Vertical markers show ideal for selected task.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <TraitBar
              label="Openness"
              value={profile.bigFive.openness}
              idealValue={idealProfile.openness}
              color={bigFiveColors.openness}
              leftLabel="Conventional"
              rightLabel="Exploratory"
            />
            <TraitBar
              label="Conscientiousness"
              value={profile.bigFive.conscientiousness}
              idealValue={idealProfile.conscientiousness}
              color={bigFiveColors.conscientiousness}
              leftLabel="Flexible"
              rightLabel="Methodical"
            />
            <TraitBar
              label="Extraversion"
              value={profile.bigFive.extraversion}
              idealValue={idealProfile.extraversion}
              color={bigFiveColors.extraversion}
              leftLabel="Concise"
              rightLabel="Verbose"
            />
            <TraitBar
              label="Agreeableness"
              value={profile.bigFive.agreeableness}
              idealValue={idealProfile.agreeableness}
              color={bigFiveColors.agreeableness}
              leftLabel="Challenging"
              rightLabel="Compliant"
            />
            <TraitBar
              label="Neuroticism"
              value={profile.bigFive.neuroticism}
              idealValue={idealProfile.neuroticism}
              color={bigFiveColors.neuroticism}
              leftLabel="Stable"
              rightLabel="Reactive"
            />
          </CardContent>
        </Card>

        {/* MBTI */}
        <Card>
          <CardHeader>
            <CardTitle>MBTI Dimensions</CardTitle>
            <CardDescription>
              Cognitive style inferred from interaction patterns
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <MBTIDimension
              label="Energy"
              value={profile.mbti.ei}
              leftPole="Introversion (I)"
              rightPole="Extraversion (E)"
            />
            <MBTIDimension
              label="Information"
              value={profile.mbti.sn}
              leftPole="Sensing (S)"
              rightPole="iNtuition (N)"
            />
            <MBTIDimension
              label="Decisions"
              value={profile.mbti.tf}
              leftPole="Thinking (T)"
              rightPole="Feeling (F)"
            />
            <MBTIDimension
              label="Structure"
              value={profile.mbti.jp}
              leftPole="Judging (J)"
              rightPole="Perceiving (P)"
            />
          </CardContent>
        </Card>
      </div>

      {/* Behavioral Signals */}
      <Card>
        <CardHeader>
          <CardTitle>Behavioral Signals</CardTitle>
          <CardDescription>
            Raw metrics extracted from conversation traces that drive personality inference
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: 'Tool Diversity', value: profile.signals.toolDiversity.toFixed(3) },
              { label: 'Read-Before-Edit', value: profile.signals.readBeforeEditRatio.toFixed(2) },
              { label: 'Output/Input Ratio', value: profile.signals.outputInputRatio.toFixed(2) },
              { label: 'Avg Msg Length', value: `${Math.round(profile.signals.avgAssistantMsgLength)} tok` },
              { label: 'Bash/Total Ratio', value: profile.signals.bashToTotalRatio.toFixed(3) },
              { label: 'Edit/Read Ratio', value: profile.signals.editToReadRatio.toFixed(2) },
              { label: 'Tool Entropy', value: profile.signals.toolTransitionEntropy.toFixed(2) },
              { label: 'Duration CV', value: profile.signals.sessionDurationVariance.toFixed(2) },
              { label: 'Tools/Message', value: profile.signals.avgToolCallsPerMessage.toFixed(2) },
              { label: 'Overflow Rate', value: `${(profile.signals.contextOverflowRate * 100).toFixed(1)}%` },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-lg font-semibold">{value}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {profile.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Personality Tuning Recommendations</CardTitle>
                <CardDescription>
                  Adjustments to better fit the {TASK_OPTIONS.find(t => t.value === targetTask)?.label} personality profile
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {profile.recommendations.map((rec) => (
                <div key={rec.trait} className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">{rec.trait}</Badge>
                    <span className="text-sm text-muted-foreground">{rec.current}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm font-medium">{rec.ideal}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{rec.promptSnippet}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Prompt */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Generated System Prompt</CardTitle>
              <CardDescription>
                Add this to your AI assistant's system prompt to tune its personality for {TASK_OPTIONS.find(t => t.value === targetTask)?.label}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleCopyPrompt} className="gap-2">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-4 text-sm whitespace-pre-wrap">
            {profile.systemPrompt}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
