import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppCredentials } from '@/lib/whatsapp-credentials';
import { redis, isRedisAvailable } from '@/lib/redis';

const META_API_VERSION = 'v21.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

interface RouteContext {
  params: Promise<{ phoneNumberId: string }>;
}

// Get verify token from Redis (same logic as webhook endpoint)
async function getVerifyToken(): Promise<string> {
  if (isRedisAvailable() && redis) {
    const storedToken = await redis.get('webhook:verify_token');
    if (storedToken) {
      return storedToken as string;
    }
    // Generate new UUID token and store in Redis
    const newToken = crypto.randomUUID();
    await redis.set('webhook:verify_token', newToken);
    return newToken;
  }
  return process.env.WEBHOOK_VERIFY_TOKEN || 'smartzap_verify_token';
}

/**
 * POST /api/phone-numbers/[phoneNumberId]/webhook/override
 * Set webhook override URL for a specific phone number
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { phoneNumberId } = await context.params;
    
    // Try to get credentials from request body first, then fallback to Redis
    let accessToken: string | undefined;
    let callbackUrl: string | undefined;
    
    try {
      const body = await request.json();
      // Only use accessToken from body if it's a valid non-empty string
      if (body.accessToken && typeof body.accessToken === 'string' && body.accessToken.trim().length > 10) {
        accessToken = body.accessToken.trim();
      }
      callbackUrl = body.callbackUrl;
    } catch {
      // Empty body, will use Redis credentials
    }
    
    // Always try Redis credentials if we don't have a valid token yet
    if (!accessToken) {
      const credentials = await getWhatsAppCredentials();
      if (credentials?.accessToken) {
        accessToken = credentials.accessToken;
      }
    }
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token não configurado' },
        { status: 401 }
      );
    }
    
    if (!callbackUrl) {
      return NextResponse.json(
        { error: 'callbackUrl é obrigatório' },
        { status: 400 }
      );
    }

    // Get verify token from Redis (ensures consistency with webhook endpoint)
    const verifyTokenFromRedis = await getVerifyToken();

    // Call Meta API to set webhook override on phone number
    // Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/override
    const response = await fetch(
      `${META_API_BASE}/${phoneNumberId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhook_configuration: {
            override_callback_uri: callbackUrl,
            verify_token: verifyTokenFromRedis,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Meta API error setting webhook override:', errorData);
      return NextResponse.json(
        { 
          error: errorData.error?.message || 'Erro ao configurar webhook override',
          details: errorData.error 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ 
      success: true, 
      message: 'Webhook override configurado com sucesso',
      data 
    });

  } catch (error) {
    console.error('Error setting webhook override:', error);
    return NextResponse.json(
      { error: 'Erro interno ao configurar webhook' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/phone-numbers/[phoneNumberId]/webhook/override
 * Remove webhook override for a specific phone number
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { phoneNumberId } = await context.params;
    
    // Try to get credentials from request body first, then fallback to Redis
    let accessToken: string | undefined;
    
    try {
      const body = await request.json();
      // Only use accessToken from body if it's a valid non-empty string
      if (body.accessToken && typeof body.accessToken === 'string' && body.accessToken.trim().length > 10) {
        accessToken = body.accessToken.trim();
      }
    } catch {
      // Empty body, will use Redis credentials
    }
    
    // Always try Redis credentials if we don't have a valid token yet
    if (!accessToken) {
      const credentials = await getWhatsAppCredentials();
      if (credentials?.accessToken) {
        accessToken = credentials.accessToken;
      }
    }
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token não configurado' },
        { status: 401 }
      );
    }

    // Call Meta API to remove webhook override (set empty string)
    // Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/override
    const response = await fetch(
      `${META_API_BASE}/${phoneNumberId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhook_configuration: {
            override_callback_uri: '',
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Meta API error removing webhook override:', errorData);
      return NextResponse.json(
        { 
          error: errorData.error?.message || 'Erro ao remover webhook override',
          details: errorData.error 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ 
      success: true, 
      message: 'Webhook override removido com sucesso',
      data 
    });

  } catch (error) {
    console.error('Error removing webhook override:', error);
    return NextResponse.json(
      { error: 'Erro interno ao remover webhook' },
      { status: 500 }
    );
  }
}
