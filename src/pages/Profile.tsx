import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthToken } from '../auth/useAuthToken'
import { decodeJwtPayload } from '../api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { ImageCropDialog } from '@/components/ImageCropDialog'
import { Switch } from '@/components/ui/switch'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useUserProfile, useUpdateGameName, useUploadProfilePicture, useUpdateAutoTeam } from '@/hooks/useQueries'
import {
  Loader2,
  AlertCircle,
  Check,
  Camera,
  User,
  Pencil,
  FlaskConical,
  Keyboard,
  ChevronRight,
  Info,
} from 'lucide-react'
import { useKeyboard } from '@/keyboard/useKeyboard'

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
  const fileInputRef = useRef<HTMLInputElement>(null)

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
  const autoTeamMutation = useUpdateAutoTeam()

  const [gameName, setGameName] = useState('')
  const [savedProfileUrl, setSavedProfileUrl] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Crop dialog state
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null)

  // Sync form state when profile loads
  useEffect(() => {
    if (user) {
      setGameName(user.gamename || user.email || emailFromToken || '')
      if (user.profielpic) setSavedProfileUrl(base64ToBlobUrl(user.profielpic))
    }
  }, [user, emailFromToken])

  useEffect(() => {
    if (!token) navigate('/')
  }, [token, navigate])

  const error = queryError ? (queryError instanceof Error ? queryError.message : 'Failed to load profile') : null
  const uploading = updateGameNameMutation.isPending || uploadPictureMutation.isPending

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  // Step 1: User picks a file → read as data URL → open crop dialog
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setRawImageSrc(reader.result as string)
      setCropDialogOpen(true)
    }
    reader.readAsDataURL(file)
    // Reset input so the same file can be re-selected
    e.target.value = ''
  }

  // Step 2: User confirms crop → upload cropped file
  const handleCroppedImage = (croppedFile: File) => {
    setCropDialogOpen(false)
    setRawImageSrc(null)
    // Show preview immediately
    const previewUrl = URL.createObjectURL(croppedFile)
    setSavedProfileUrl(previewUrl)
    // Upload
    uploadPictureMutation.mutate(croppedFile, {
      onSuccess: () => showSuccess('Profile picture updated!'),
      onError: () => {
        // Revert preview on failure
        if (user?.profielpic) setSavedProfileUrl(base64ToBlobUrl(user.profielpic))
        else setSavedProfileUrl(null)
      },
    })
  }

  const handleGameNameUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    updateGameNameMutation.mutate(gameName, {
      onSuccess: () => showSuccess('Game name updated!'),
    })
  }

  const mutationError = updateGameNameMutation.error || uploadPictureMutation.error
  const displayError = error || (mutationError instanceof Error ? mutationError.message : mutationError ? 'Something went wrong' : null)

  const displayEmail = user?.email || emailFromToken || 'Unknown'


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
      <div className="container py-8 max-w-lg space-y-6">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-28 w-28 rounded-full" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
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

  return (
    <div className="container py-8 max-w-lg">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="sr-only"
      />

      {/* Crop Dialog */}
      <ImageCropDialog
        open={cropDialogOpen}
        imageSrc={rawImageSrc}
        onClose={() => {
          setCropDialogOpen(false)
          setRawImageSrc(null)
        }}
        onCropComplete={handleCroppedImage}
      />

      {/* Profile header — avatar + identity */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative group mb-4" data-tour="profile-avatar">
          <Avatar className="h-28 w-28 border-4 border-background shadow-lg">
            {savedProfileUrl && <AvatarImage src={savedProfileUrl} />}
            <AvatarFallback>
              <Camera className="h-10 w-10 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>

          {/* Hover overlay to change photo */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
          >
            <Camera className="h-5 w-5 text-white mb-0.5" />
            <span className="text-[10px] font-medium text-white/90">Change</span>
          </button>

          {/* Upload spinner overlay */}
          {uploadPictureMutation.isPending && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Change photo text button (always visible, good for mobile) */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-sm text-primary hover:text-primary/80 font-medium transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          Change photo
        </button>

        <h1 className="text-xl font-bold mt-3">{user?.gamename || displayEmail}</h1>
        <p className="text-sm text-muted-foreground">{displayEmail}</p>
      </div>

      {/* Notifications */}
      {displayError && (
        <Card className="border-destructive/50 mb-4">
          <CardContent className="flex items-center gap-3 py-3 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {displayError}
          </CardContent>
        </Card>
      )}
      {successMessage && (
        <Card className="border-primary/50 mb-4">
          <CardContent className="flex items-center gap-3 py-3 text-primary text-sm">
            <Check className="h-4 w-4 shrink-0" />
            {successMessage}
          </CardContent>
        </Card>
      )}

      {/* Game name card */}
      <Card data-tour="profile-game-name">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Pencil className="h-4 w-4 text-muted-foreground" />
            Game Name
          </CardTitle>
          <CardDescription>This is how you appear on the leaderboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGameNameUpdate} className="flex gap-3">
            <Input
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              disabled={uploading}
              placeholder="Enter your game name"
              className="flex-1"
            />
            <Button type="submit" disabled={uploading} size="default" className="gap-2 shrink-0">
              {updateGameNameMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Save
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card className="mt-4" data-tour="profile-preferences">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
            Preferences
          </CardTitle>
          <CardDescription>Experimental features you can try out</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <label htmlFor="autoteam" className="text-sm font-medium cursor-pointer">
                Auto-pick Smart XI
              </label>
              {/* Tooltip for desktop hover */}
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="hidden sm:inline-flex text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                      <Info className="h-3.5 w-3.5" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-60 text-center">
                    If you miss picking your team before a match, we'll auto-select a Smart XI for you so you never miss out on points.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {/* Popover for mobile tap */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="sm:hidden text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" className="max-w-60 text-center">
                  If you miss picking your team before a match, we'll auto-select a Smart XI for you so you never miss out on points.
                </PopoverContent>
              </Popover>
            </div>
            <Switch
              id="autoteam"
              data-tour="profile-autoteam-switch"
              checked={user?.autoteam ?? true}
              disabled={autoTeamMutation.isPending}
              onCheckedChange={(checked) => {
                autoTeamMutation.mutate(checked, {
                  onSuccess: () => showSuccess('Preference updated!'),
                })
              }}
            />
          </div>

          {/* Keyboard Shortcuts — desktop only */}
          <KeyboardShortcutsRow />
        </CardContent>
      </Card>

    </div>
  )
}

function KeyboardShortcutsRow() {
  const { setHelpModalOpen, setHelpCustomizing, disabledShortcuts } = useKeyboard()
  const disabledCount = disabledShortcuts.size

  return (
    <div className="hidden md:flex items-center justify-between gap-4 pt-3 mt-3 border-t">
      <div className="flex items-center gap-2 min-w-0">
        <Keyboard className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium">Keyboard Shortcuts</span>
        {disabledCount > 0 && (
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
            {disabledCount} off
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => { setHelpCustomizing(true); setHelpModalOpen(true) }}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        Manage
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
