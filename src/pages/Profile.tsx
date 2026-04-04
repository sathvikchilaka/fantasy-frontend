import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthToken } from '../auth/useAuthToken'
import { decodeJwtPayload } from '../api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { useUserProfile, useUpdateGameName, useUploadProfilePicture } from '@/hooks/useQueries'
import {
  Loader2,
  AlertCircle,
  Check,
  Upload,
  Camera,
  User,
} from 'lucide-react'

function base64ToBlobUrl(base64: string | null | undefined): string | null {
  if (!base64) return null
  try {
    const raw = window.atob(base64)
    const uInt8Array = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; ++i) uInt8Array[i] = raw.charCodeAt(i)
    const blob = new Blob([uInt8Array], { type: 'image/png' })
    return URL.createObjectURL(blob)
  } catch {
    return null
  }
}

export function Profile() {
  const token = useAuthToken()
  const navigate = useNavigate()

  const emailFromToken = useMemo(() => {
    const payload = decodeJwtPayload(token)
    if (!payload) return null
    for (const k of ['email', 'upn', 'preferred_username', 'sub']) {
      const v = payload[k]
      if (typeof v === 'string' && v.trim().length > 0) return v
    }
    return null
  }, [token])

  const { data: user, isLoading: loading, error: queryError } = useUserProfile(!!token)
  const updateGameNameMutation = useUpdateGameName()
  const uploadPictureMutation = useUploadProfilePicture()

  const [gameName, setGameName] = useState('')
  const [profilePicture, setProfilePicture] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Sync form state when profile loads
  useEffect(() => {
    if (user) {
      setGameName(user.gamename || user.email || emailFromToken || '')
      if (user.profielpic) setPreviewUrl(base64ToBlobUrl(user.profielpic))
    }
  }, [user, emailFromToken])

  useEffect(() => {
    if (!token) navigate('/')
  }, [token, navigate])

  const error = queryError ? (queryError instanceof Error ? queryError.message : 'Failed to load profile') : null
  const uploading = updateGameNameMutation.isPending || uploadPictureMutation.isPending

  const handlePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setProfilePicture(file)
      const reader = new FileReader()
      reader.onloadend = () => setPreviewUrl(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleGameNameUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    updateGameNameMutation.mutate(gameName, {
      onSuccess: () => {
        setSuccessMessage('Game name updated!')
        setTimeout(() => setSuccessMessage(null), 3000)
      },
    })
  }

  const handlePictureUpload = (e: React.FormEvent) => {
    e.preventDefault()
    if (!profilePicture) return
    uploadPictureMutation.mutate(profilePicture, {
      onSuccess: () => {
        setProfilePicture(null)
        setSuccessMessage('Profile picture updated!')
        setTimeout(() => setSuccessMessage(null), 3000)
      },
    })
  }

  const mutationError = updateGameNameMutation.error || uploadPictureMutation.error
  const displayError = error || (mutationError instanceof Error ? mutationError.message : mutationError ? 'Something went wrong' : null)

  if (!token) {
    return (
      <div className="container py-20 text-center">
        <User className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground">Please sign in to view your profile</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container py-8 max-w-2xl space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="rounded-xl border bg-card p-6 flex flex-col sm:flex-row items-center gap-6">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="flex-1 space-y-3 w-full">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-9 w-32 rounded-md" />
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6 space-y-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-48" />
          <div className="flex gap-3">
            <Skeleton className="h-9 flex-1 rounded-md" />
            <Skeleton className="h-9 w-20 rounded-md" />
          </div>
        </div>
      </div>
    )
  }

  if (!user && !emailFromToken) {
    return (
      <div className="container py-20 text-center">
        <AlertCircle className="h-12 w-12 text-destructive/30 mx-auto mb-4" />
        <p className="text-muted-foreground">Failed to load profile</p>
      </div>
    )
  }

  const displayEmail = user?.email || emailFromToken || 'Unknown'

  return (
    <div className="container py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground mt-1">{displayEmail}</p>
      </div>

      {displayError && (
        <Card className="border-destructive/50 mb-6">
          <CardContent className="flex items-center gap-3 pt-6 text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0" />
            {displayError}
          </CardContent>
        </Card>
      )}
      {successMessage && (
        <Card className="border-primary/50 mb-6">
          <CardContent className="flex items-center gap-3 pt-6 text-primary">
            <Check className="h-5 w-5 shrink-0" />
            {successMessage}
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile Picture</CardTitle>
            <CardDescription>Upload an image to personalize your profile</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative group">
                <Avatar className="h-24 w-24">
                  {previewUrl && <AvatarImage src={previewUrl} />}
                  <AvatarFallback className="text-2xl font-bold">
                    {user?.gamename?.charAt(0)?.toUpperCase() ?? displayEmail.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <label className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="h-6 w-6 text-white" />
                  <input type="file" accept="image/*" onChange={handlePictureChange} disabled={uploading} className="sr-only" />
                </label>
              </div>
              <form onSubmit={handlePictureUpload} className="flex-1 space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Choose image</label>
                  <Input type="file" accept="image/*" onChange={handlePictureChange} disabled={uploading} />
                  {profilePicture && <p className="text-xs text-muted-foreground mt-1">Selected: {profilePicture.name}</p>}
                </div>
                <Button type="submit" disabled={!profilePicture || uploading} size="sm" className="gap-2">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? 'Uploading...' : 'Upload Picture'}
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Game Name</CardTitle>
            <CardDescription>This is how you appear on the leaderboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGameNameUpdate} className="flex flex-col sm:flex-row gap-3">
              <Input
                type="text"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                disabled={uploading}
                placeholder="Enter your game name"
                className="flex-1"
              />
              <Button type="submit" disabled={uploading} size="default" className="gap-2 shrink-0">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {uploading ? 'Saving...' : 'Save'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
