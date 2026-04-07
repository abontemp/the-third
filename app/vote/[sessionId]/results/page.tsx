'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { logger } from '@/lib/utils/logger'
import { getDisplayName as getDisplayNameUtil } from '@/lib/utils/displayName'
import { ArrowLeft, Loader, TrendingUp, TrendingDown, Sparkles, Flame, Trophy, Target, Share2, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

type PodiumResult = {
  player_id: string
  player_name: string
  vote_count: number
  percentage: number
  rank: number
}

type VotingSession = {
  id: string
  status: string
  include_predictions: boolean
  include_best_action: boolean
  include_worst_action: boolean
  top_reader_id?: string
  flop_reader_id?: string
  match: { opponent: string; match_date: string }
}

export default function ResultsPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params?.sessionId as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<VotingSession | null>(null)
  const [topResults, setTopResults] = useState<PodiumResult[]>([])
  const [flopResults, setFlopResults] = useState<PodiumResult[]>([])
  const [bestActionResults, setBestActionResults] = useState<PodiumResult[]>([])
  const [worstActionResults, setWorstActionResults] = useState<PodiumResult[]>([])
  const [predictionStats, setPredictionStats] = useState<{ top_correct: number; flop_correct: number; both_correct: number; total_predictions: number } | null>(null)
  const [copied, setCopied] = useState(false)

  // Animation state — chaque section révèle progressivement
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})

  useEffect(() => { loadResults() }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const reveal = (key: string, delay: number) => {
    setTimeout(() => setRevealed(prev => ({ ...prev, [key]: true })), delay)
  }

  const loadResults = async () => {
    try {
      setLoading(true)

      const { data: sessionData } = await supabase
        .from('voting_sessions')
        .select('id, status, include_predictions, include_best_action, include_worst_action, top_reader_id, flop_reader_id, match:match_id(opponent, match_date)')
        .eq('id', sessionId)
        .single()

      if (!sessionData) { toast.error('Session introuvable'); router.push('/dashboard'); return }

      const sessionFormatted: VotingSession = {
        ...sessionData,
        match: Array.isArray(sessionData.match) ? sessionData.match[0] : sessionData.match
      }
      setSession(sessionFormatted)

      const { data: votesData } = await supabase.from('votes').select('*').eq('session_id', sessionId)
      if (!votesData?.length) { setLoading(false); return }

      const allPlayerIds = new Set<string>()
      votesData.forEach(v => {
        allPlayerIds.add(v.top_player_id)
        allPlayerIds.add(v.flop_player_id)
        if (v.best_action_player_id) allPlayerIds.add(v.best_action_player_id)
        if (v.worst_action_player_id) allPlayerIds.add(v.worst_action_player_id)
      })

      const { data: profilesData } = await supabase
        .from('profiles').select('id, first_name, last_name, nickname, email')
        .in('id', Array.from(allPlayerIds))

      const getName = (id: string) => getDisplayNameUtil(profilesData?.find(p => p.id === id))

      const buildRanked = (votesMap: Record<string, number>, total: number): PodiumResult[] => {
        const sorted = Object.entries(votesMap)
          .map(([id, count]) => ({ player_id: id, player_name: getName(id), vote_count: count, percentage: Math.round((count / total) * 100), rank: 0 }))
          .sort((a, b) => b.vote_count - a.vote_count)

        let currentRank = 1
        return sorted.map((r, i) => {
          if (i > 0 && r.vote_count !== sorted[i - 1].vote_count) currentRank = i + 1
          return { ...r, rank: currentRank }
        }).filter(r => r.rank <= 3)
      }

      const topMap: Record<string, number> = {}
      const flopMap: Record<string, number> = {}
      const bestMap: Record<string, number> = {}
      const worstMap: Record<string, number> = {}

      votesData.forEach(v => {
        topMap[v.top_player_id] = (topMap[v.top_player_id] || 0) + 1
        flopMap[v.flop_player_id] = (flopMap[v.flop_player_id] || 0) + 1
        if (v.best_action_player_id) bestMap[v.best_action_player_id] = (bestMap[v.best_action_player_id] || 0) + 1
        if (v.worst_action_player_id) worstMap[v.worst_action_player_id] = (worstMap[v.worst_action_player_id] || 0) + 1
      })

      const top = buildRanked(topMap, votesData.length)
      const flop = buildRanked(flopMap, votesData.length)
      const best = buildRanked(bestMap, votesData.length)
      const worst = buildRanked(worstMap, votesData.length)

      setTopResults(top)
      setFlopResults(flop)
      setBestActionResults(best)
      setWorstActionResults(worst)

      if (sessionFormatted.include_predictions && top.length > 0 && flop.length > 0) {
        const topWinner = top[0].player_id
        const flopWinner = flop[0].player_id
        let tc = 0, fc = 0, bc = 0, total = 0
        votesData.forEach(v => {
          if (v.predicted_top_id && v.predicted_flop_id) {
            total++
            const it = v.predicted_top_id === topWinner
            const ifl = v.predicted_flop_id === flopWinner
            if (it) tc++
            if (ifl) fc++
            if (it && ifl) bc++
          }
        })
        setPredictionStats({ top_correct: tc, flop_correct: fc, both_correct: bc, total_predictions: total })
      }

      // Reveals progressifs
      reveal('header', 100)
      reveal('top', 400)
      reveal('flop', 700)
      reveal('best', 1000)
      reveal('worst', 1300)
      reveal('predictions', 1600)
      reveal('share', 1900)

    } catch (err) {
      logger.error('Erreur:', err)
      toast.error('Erreur lors du chargement des résultats')
    } finally {
      setLoading(false)
    }
  }

  const handleShare = async () => {
    if (!shareImageUrl) return

    // Essaye de partager l'image directement (Web Share API niveau 2)
    if ('share' in navigator && 'canShare' in navigator) {
      try {
        const res = await fetch(shareImageUrl)
        const blob = await res.blob()
        const file = new File([blob], `resultats-vs-${session?.match.opponent || 'match'}.png`, { type: 'image/png' })

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Résultats vs ${session?.match.opponent}`,
            text: `TOP & FLOP du match vs ${session?.match.opponent} 🏆`,
          })
          return
        }
      } catch { /* fallback ci-dessous */ }
    }

    // Fallback : copier le lien
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      toast.success('Lien copié !')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Impossible de copier le lien')
    }
  }

  const shareImageUrl = session ? [
    `/api/og/results?opponent=${encodeURIComponent(session.match.opponent)}`,
    `&date=${encodeURIComponent(session.match.match_date)}`,
    `&top=${encodeURIComponent(topResults[0]?.player_name || '')}`,
    `&topVotes=${topResults[0]?.vote_count || 0}`,
    `&flop=${encodeURIComponent(flopResults[0]?.player_name || '')}`,
    `&flopVotes=${flopResults[0]?.vote_count || 0}`,
    session.include_best_action && bestActionResults[0] ? `&bestAction=${encodeURIComponent(bestActionResults[0].player_name)}&bestActionVotes=${bestActionResults[0].vote_count}` : '',
  ].join('') : ''

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <Trophy className="text-yellow-400" size={64} />
          <div className="absolute inset-0 animate-ping rounded-full bg-yellow-400/20" />
        </div>
        <p className="text-white text-lg font-semibold animate-pulse">Calcul des résultats…</p>
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 pb-16">
      {/* Header sticky */}
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-gray-400 hover:text-white transition">
            <ArrowLeft size={20} />
            <span className="text-sm">Dashboard</span>
          </button>
          <span className="text-white font-semibold text-sm">vs {session.match.opponent}</span>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/30 text-purple-300 px-3 py-1.5 rounded-lg text-sm font-medium transition"
          >
            {copied ? <Check size={15} /> : <Share2 size={15} />}
            Partager
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-8 space-y-8">

        {/* Titre */}
        <div
          className="text-center transition-all duration-700"
          style={{ opacity: revealed.header ? 1 : 0, transform: revealed.header ? 'translateY(0)' : 'translateY(24px)' }}
        >
          <div className="relative inline-block mb-4">
            <Trophy className="text-yellow-400" size={72} />
            <div className="absolute -inset-4 rounded-full bg-yellow-400/10 animate-pulse" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-1">Résultats du match</h1>
          <p className="text-purple-300 text-lg font-medium">vs {session.match.opponent}</p>
          <p className="text-gray-400 text-sm mt-1">
            {new Date(session.match.match_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* TOP */}
        <Section revealed={!!revealed.top} delay={0}>
          <SectionHeader icon={<TrendingUp className="text-green-400" size={28} />} label="TOP du match" color="text-green-400" />
          <Podium results={topResults} colorClass="green" />
        </Section>

        {/* FLOP */}
        <Section revealed={!!revealed.flop} delay={0}>
          <SectionHeader icon={<TrendingDown className="text-red-400" size={28} />} label="FLOP du match" color="text-red-400" />
          <Podium results={flopResults} colorClass="red" />
        </Section>

        {/* BEST ACTION */}
        {session.include_best_action && bestActionResults.length > 0 && (
          <Section revealed={!!revealed.best} delay={0}>
            <SectionHeader icon={<Sparkles className="text-amber-400" size={28} />} label="Plus beau geste" color="text-amber-400" />
            <Podium results={bestActionResults} colorClass="amber" />
          </Section>
        )}

        {/* WORST ACTION */}
        {session.include_worst_action && worstActionResults.length > 0 && (
          <Section revealed={!!revealed.worst} delay={0}>
            <SectionHeader icon={<Flame className="text-pink-400" size={28} />} label="Plus beau fail" color="text-pink-400" />
            <Podium results={worstActionResults} colorClass="pink" />
          </Section>
        )}

        {/* PRÉDICTIONS */}
        {predictionStats && predictionStats.total_predictions > 0 && (
          <Section revealed={!!revealed.predictions} delay={0}>
            <SectionHeader icon={<Target className="text-purple-400" size={28} />} label="Prédictions" color="text-purple-400" />
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { label: 'TOP correct', value: predictionStats.top_correct, color: 'text-green-400' },
                { label: 'FLOP correct', value: predictionStats.flop_correct, color: 'text-red-400' },
                { label: 'Parfaites', value: predictionStats.both_correct, color: 'text-purple-400' },
              ].map(stat => (
                <div key={stat.label} className="bg-slate-800/60 rounded-xl p-4 text-center">
                  <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}<span className="text-gray-500 text-lg">/{predictionStats.total_predictions}</span></p>
                  <p className="text-gray-400 text-xs mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* BOUTON PARTAGE + IMAGE */}
        <div
          className="transition-all duration-700"
          style={{ opacity: revealed.share ? 1 : 0, transform: revealed.share ? 'translateY(0)' : 'translateY(16px)' }}
        >
          <div className="bg-slate-800/40 border border-white/10 rounded-2xl p-6 text-center space-y-4">
            <p className="text-white font-semibold">Partager les résultats</p>
            <p className="text-gray-400 text-sm">Partage l&apos;image du TOP &amp; FLOP directement dans tes apps</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition"
              >
                {copied ? <Check size={18} /> : <Share2 size={18} />}
                {copied ? 'Lien copié !' : 'Partager l\'image'}
              </button>
              <a
                href={shareImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 border border-white/10 text-white px-6 py-3 rounded-xl font-semibold transition"
              >
                <Copy size={18} />
                Ouvrir l&apos;image
              </a>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Composants locaux ────────────────────────────────────────────

function Section({ children, revealed, delay }: { children: React.ReactNode; revealed: boolean; delay: number }) {
  return (
    <div
      className="bg-slate-800/40 border border-white/10 rounded-2xl p-6 transition-all duration-700"
      style={{
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'translateY(0)' : 'translateY(32px)',
        transitionDelay: `${delay}ms`
      }}
    >
      {children}
    </div>
  )
}

function SectionHeader({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      {icon}
      <h2 className={`text-xl font-bold text-white`}>{label}</h2>
    </div>
  )
}

const colorMap: Record<string, { bar: string; text: string; glow: string; bg: string }> = {
  green: { bar: 'from-green-500 to-emerald-600', text: 'text-green-400', glow: 'shadow-green-500/40', bg: 'bg-green-500/10' },
  red:   { bar: 'from-red-500 to-orange-600',   text: 'text-red-400',   glow: 'shadow-red-500/40',   bg: 'bg-red-500/10' },
  amber: { bar: 'from-amber-500 to-yellow-600', text: 'text-amber-400', glow: 'shadow-amber-500/40', bg: 'bg-amber-500/10' },
  pink:  { bar: 'from-pink-500 to-rose-600',    text: 'text-pink-400',  glow: 'shadow-pink-500/40',  bg: 'bg-pink-500/10' },
}

const rankLabel: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }
const barHeights: Record<number, string> = { 1: '120px', 2: '80px', 3: '56px' }

function Podium({ results, colorClass }: { results: PodiumResult[]; colorClass: string }) {
  const c = colorMap[colorClass]

  if (!results.length) return <p className="text-center text-gray-400 py-4">Aucun vote</p>

  // Grouper par rang
  const grouped: Record<number, PodiumResult[]> = {}
  results.forEach(r => { grouped[r.rank] = [...(grouped[r.rank] || []), r] })
  const ranks = Object.keys(grouped).map(Number).sort()

  // Ordre visuel : 2 - 1 - 3
  const ordered = [2, 1, 3].filter(r => grouped[r])

  return (
    <div>
      {/* Podium visuel */}
      <div className="flex items-end justify-center gap-2 sm:gap-4 mb-6">
        {ordered.map(rank => {
          const players = grouped[rank]
          const isWinner = rank === 1
          return (
            <div key={rank} className="flex flex-col items-center" style={{ minWidth: isWinner ? 120 : 90 }}>
              {/* Emoji médaille */}
              <span className="text-2xl sm:text-3xl mb-2">{rankLabel[rank]}</span>

              {/* Noms */}
              <div className="text-center mb-2 space-y-1">
                {players.map(p => (
                  <div key={p.player_id}>
                    <p className={`font-bold text-white text-xs sm:text-sm leading-tight ${isWinner ? 'text-sm sm:text-base' : ''}`}>{p.player_name}</p>
                    <p className={`${c.text} text-xs font-semibold`}>{p.vote_count}v · {p.percentage}%</p>
                  </div>
                ))}
              </div>

              {/* Barre */}
              <div
                className={`w-full bg-gradient-to-t ${c.bar} rounded-t-lg flex items-center justify-center ${isWinner ? `shadow-lg ${c.glow}` : ''}`}
                style={{ height: barHeights[rank] || '56px' }}
              >
                <span className="text-white font-black text-lg sm:text-2xl">{rank}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Liste complète sous le podium */}
      <div className="space-y-2 mt-2">
        {ranks.map(rank => (
          grouped[rank].map(p => (
            <div key={p.player_id} className={`flex items-center gap-3 ${c.bg} rounded-xl px-4 py-2.5 ${rank === 1 ? 'border border-white/10' : ''}`}>
              <span className="text-lg w-8 text-center">{rankLabel[rank]}</span>
              <span className="text-white font-semibold flex-1">{p.player_name}</span>
              <span className={`${c.text} font-bold text-sm`}>{p.vote_count} vote{p.vote_count > 1 ? 's' : ''}</span>
              <div className="w-16 bg-slate-700 rounded-full h-1.5 overflow-hidden">
                <div className={`h-full bg-gradient-to-r ${c.bar} rounded-full`} style={{ width: `${p.percentage}%` }} />
              </div>
              <span className="text-gray-400 text-xs w-8 text-right">{p.percentage}%</span>
            </div>
          ))
        ))}
      </div>
    </div>
  )
}
