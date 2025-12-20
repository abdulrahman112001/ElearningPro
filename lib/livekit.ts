/**
 * LiveKit Integration for Live Streaming
 */

import { AccessToken, RoomServiceClient } from "livekit-server-sdk"

const livekitHost = process.env.LIVEKIT_URL || "wss://your-livekit-server.com"
const apiKey = process.env.LIVEKIT_API_KEY || ""
const apiSecret = process.env.LIVEKIT_API_SECRET || ""

// Create a room service client
export function getRoomService() {
  return new RoomServiceClient(livekitHost, apiKey, apiSecret)
}

// Generate access token for participant
export function generateToken(
  roomName: string,
  participantName: string,
  participantIdentity: string,
  isHost: boolean = false
): string {
  const token = new AccessToken(apiKey, apiSecret, {
    identity: participantIdentity,
    name: participantName,
  })

  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: isHost, // Only host can publish
    canPublishData: true,
    canSubscribe: true,
  })

  return token.toJwt()
}

// Create a new room
export async function createRoom(roomName: string, emptyTimeout: number = 300) {
  const roomService = getRoomService()

  try {
    const room = await roomService.createRoom({
      name: roomName,
      emptyTimeout, // Seconds to wait before closing empty room
      maxParticipants: 1000, // Max participants
    })
    return room
  } catch (error) {
    console.error("Failed to create room:", error)
    throw error
  }
}

// List all rooms
export async function listRooms() {
  const roomService = getRoomService()

  try {
    const rooms = await roomService.listRooms()
    return rooms
  } catch (error) {
    console.error("Failed to list rooms:", error)
    throw error
  }
}

// Get room info
export async function getRoom(roomName: string) {
  const roomService = getRoomService()

  try {
    const rooms = await roomService.listRooms([roomName])
    return rooms[0] || null
  } catch (error) {
    console.error("Failed to get room:", error)
    throw error
  }
}

// Delete a room
export async function deleteRoom(roomName: string) {
  const roomService = getRoomService()

  try {
    await roomService.deleteRoom(roomName)
    return true
  } catch (error) {
    console.error("Failed to delete room:", error)
    throw error
  }
}

// Get participants in a room
export async function getParticipants(roomName: string) {
  const roomService = getRoomService()

  try {
    const participants = await roomService.listParticipants(roomName)
    return participants
  } catch (error) {
    console.error("Failed to get participants:", error)
    throw error
  }
}

// Remove participant from room
export async function removeParticipant(roomName: string, identity: string) {
  const roomService = getRoomService()

  try {
    await roomService.removeParticipant(roomName, identity)
    return true
  } catch (error) {
    console.error("Failed to remove participant:", error)
    throw error
  }
}

// Mute participant
export async function muteParticipant(
  roomName: string,
  identity: string,
  trackSid: string,
  muted: boolean
) {
  const roomService = getRoomService()

  try {
    await roomService.mutePublishedTrack(roomName, identity, trackSid, muted)
    return true
  } catch (error) {
    console.error("Failed to mute participant:", error)
    throw error
  }
}

// Send data message to room
export async function sendDataMessage(
  roomName: string,
  data: Uint8Array,
  destinationIdentities?: string[]
) {
  const roomService = getRoomService()

  try {
    await roomService.sendData(roomName, data, {
      destinationIdentities,
    })
    return true
  } catch (error) {
    console.error("Failed to send data message:", error)
    throw error
  }
}

// Start recording (requires Egress)
export async function startRecording(roomName: string, outputPath: string) {
  // This requires LiveKit Egress to be set up
  // Implementation would depend on your storage configuration
  console.log(`Starting recording for room ${roomName} to ${outputPath}`)
  // const egressClient = new EgressClient(livekitHost, apiKey, apiSecret);
  // await egressClient.startRoomCompositeEgress(roomName, { ... });
}

// Stop recording
export async function stopRecording(egressId: string) {
  // const egressClient = new EgressClient(livekitHost, apiKey, apiSecret);
  // await egressClient.stopEgress(egressId);
}
