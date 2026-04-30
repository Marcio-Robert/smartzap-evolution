import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { phoneNumberId, accessToken } = await request.json()

  if (!phoneNumberId || !accessToken) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v24.0/${phoneNumberId}?fields=display_phone_number,quality_rating,verified_name`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    )

    const data = await response.json()
    
    if (!response.ok) {
      console.error('Meta API Error (phone-number):', JSON.stringify(data, null, 2))
      const errorMessage = data.error?.message || 'Failed to fetch phone details'
      return NextResponse.json({ error: errorMessage }, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Meta API Error (phone-number):', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
