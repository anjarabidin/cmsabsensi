import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

interface EmailResponse {
  success: boolean;
  message: string;
  error?: string;
}

function handler(req: Request): Promise<Response> {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405, 
        headers: corsHeaders 
      })
    }

    const body: EmailRequest = await req.json()
    
    // Validate required fields
    if (!body.to || !body.subject || !body.html) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Missing required fields: to, subject, html' 
        } as EmailResponse),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // For development, we'll log the email details instead of actually sending
    // In production, you would integrate with an email service like:
    // - Resend
    // - SendGrid
    // - AWS SES
    // - Nodemailer (with SMTP)
    
    console.log('📧 Email Details:', {
      to: body.to,
      subject: body.subject,
      from: body.from || 'noreply@cmsdutasolusi.com',
      replyTo: body.replyTo,
      htmlLength: body.html.length,
      timestamp: new Date().toISOString()
    })

    // Mock email sending for development
    // In production, replace this with actual email service integration
    const mockSendEmail = async (): Promise<boolean> => {
      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // For development, always return success
      // In production, this would be your actual email sending logic
      return true
    }

    const emailSent = await mockSendEmail()

    if (emailSent) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Email sent successfully' 
        } as EmailResponse),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Failed to send email',
          error: 'Email service unavailable'
        } as EmailResponse),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

  } catch (error) {
    console.error('Email sending error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Internal server error',
        error: error.message 
      } as EmailResponse),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}

serve(handler)
