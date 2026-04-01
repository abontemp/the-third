import { logger } from '@/lib/utils/logger'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { team_id, requester_name } = await req.json()

    if (!team_id || !requester_name) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Récupérer le nom de l'équipe
    const { data: team } = await supabase
      .from('teams')
      .select('name')
      .eq('id', team_id)
      .single()

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    // Récupérer les managers et créateurs de l'équipe
    const { data: managers } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', team_id)
      .in('role', ['creator', 'manager'])

    if (!managers || managers.length === 0) {
      return NextResponse.json({ message: 'No managers found' })
    }

    const userIds = managers.map(m => m.user_id)

    // Récupérer leurs emails depuis profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('email')
      .in('id', userIds)
      .not('email', 'is', null)

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ message: 'No manager emails found' })
    }

    const emails = profiles.map(p => p.email).filter(Boolean) as string[]
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://the-third.vercel.app')

    await resend.emails.send({
      from: 'The Third <noreply@the-third.app>',
      to: emails,
      subject: `Nouvelle demande d'adhésion — ${team.name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; background: #0f172a; color: #f1f5f9; padding: 32px; border-radius: 12px;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
            <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #3b82f6, #f97316); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
              <span style="color: white; font-weight: bold; font-size: 14px;">III</span>
            </div>
            <span style="font-size: 20px; font-weight: bold;">The Third</span>
          </div>

          <h2 style="font-size: 22px; font-weight: bold; margin-bottom: 12px;">
            Nouvelle demande d'adhésion
          </h2>

          <p style="color: #94a3b8; line-height: 1.6; margin-bottom: 24px;">
            <strong style="color: #f1f5f9;">${requester_name}</strong> souhaite rejoindre votre équipe
            <strong style="color: #60a5fa;">${team.name}</strong>.
          </p>

          <a href="${appUrl}/dashboard"
            style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #7c3aed); color: white; padding: 12px 24px; border-radius: 8px; font-weight: bold; text-decoration: none;">
            Voir la demande →
          </a>

          <p style="color: #475569; font-size: 12px; margin-top: 32px;">
            Vous recevez cet email car vous êtes manager de l'équipe ${team.name} sur The Third.
          </p>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error('Erreur notification mail:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
