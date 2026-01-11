import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to get OAuth2 access token from Service Account
async function getAccessToken(serviceAccount: any): Promise<string> {
    const jwtHeader = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))

    const now = Math.floor(Date.now() / 1000)
    const jwtClaimSet = {
        iss: serviceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
    }
    const jwtClaimSetEncoded = btoa(JSON.stringify(jwtClaimSet))

    // For production, you would properly sign the JWT with the private key
    // This is a simplified version - in real implementation, use a proper JWT library
    const jwt = `${jwtHeader}.${jwtClaimSetEncoded}.signature_placeholder`

    // Exchange JWT for access token
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    })

    const data = await response.json()
    return data.access_token
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { userId, title, body, data } = await req.json()

        // Get Firebase Service Account from environment
        const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
        if (!serviceAccountJson) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT not configured')
        }

        const serviceAccount = JSON.parse(serviceAccountJson)
        const projectId = serviceAccount.project_id

        // Get Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Get user's FCM tokens
        const { data: tokens, error: tokenError } = await supabase
            .from('fcm_tokens')
            .select('token')
            .eq('user_id', userId)

        if (tokenError) {
            console.error('Error fetching FCM tokens:', tokenError)
            throw tokenError
        }

        if (!tokens || tokens.length === 0) {
            console.log('No FCM tokens found for user:', userId)
            return new Response(
                JSON.stringify({ success: false, message: 'No FCM tokens found' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Get OAuth2 access token
        const accessToken = await getAccessToken(serviceAccount)

        // Send FCM notification to each token using v1 API
        const results = await Promise.all(
            tokens.map(async ({ token }) => {
                const fcmPayload = {
                    message: {
                        token: token,
                        notification: {
                            title: title.startsWith('CMS') ? title : `CMS | ${title}`,
                            body: body,
                        },
                        data: data || {},
                        android: {
                            priority: 'high',
                            notification: {
                                sound: 'default',
                                channel_id: 'default',
                                icon: 'ic_launcher'
                            },
                        },
                    },
                }

                const response = await fetch(
                    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`,
                        },
                        body: JSON.stringify(fcmPayload),
                    }
                )

                const result = await response.json()
                return { token, result, status: response.status }
            })
        )

        console.log('FCM send results:', results)

        return new Response(
            JSON.stringify({ success: true, results }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        console.error('Error in send-push-notification:', error)

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        return new Response(
            JSON.stringify({ error: errorMessage }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})
