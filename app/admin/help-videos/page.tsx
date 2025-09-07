"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Video, Edit, Save, X, Plus, ArrowUp, ArrowDown } from 'lucide-react'
import { getAllHelpVideos, updateHelpVideo, createHelpVideo, HelpVideo } from '@/app/actions/help-videos'
import { convertToEmbedUrl } from '@/lib/utils'

export default function HelpVideosPage() {
  // Help Videos state
  const [helpVideos, setHelpVideos] = useState<HelpVideo[]>([])
  const [loadingVideos, setLoadingVideos] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [editingVideo, setEditingVideo] = useState<HelpVideo | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [editPosition, setEditPosition] = useState<number>(1)
  const [updatingVideo, setUpdatingVideo] = useState(false)
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null)
  
  // Create video state
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createUrl, setCreateUrl] = useState('')
  const [createVideoType, setCreateVideoType] = useState<'showcase' | 'tutorial' | 'tips'>('tutorial')
  const [createPosition, setCreatePosition] = useState<number>(1)
  const [creatingVideo, setCreatingVideo] = useState(false)
  
  // First Login Video state
  const [showFirstLoginDialog, setShowFirstLoginDialog] = useState(false)
  const [firstLoginUrl, setFirstLoginUrl] = useState('')
  const [updatingFirstLogin, setUpdatingFirstLogin] = useState(false)
  const [firstLoginVideoUrl, setFirstLoginVideoUrl] = useState('')

  // Add effect to fetch help videos and first login video
  useEffect(() => {
    const fetchHelpVideos = async () => {
      try {
        setLoadingVideos(true);
        setVideoError(null);
        
        const result = await getAllHelpVideos();
        if (result.success && result.data) {
          setHelpVideos(result.data);
        } else {
          setVideoError('Failed to load help videos');
        }
        
        // Load first login video URL from localStorage
        const savedFirstLoginUrl = localStorage.getItem('firstLoginVideoUrl');
        if (savedFirstLoginUrl) {
          setFirstLoginVideoUrl(savedFirstLoginUrl);
        } else {
          // Set default URL
          setFirstLoginVideoUrl('https://www.loom.com/share/51c0ef4fbe404e3686597e530e8fee34?sid=011650c7-9438-47ae-8cab-81cd224b45e1');
        }
      } catch (err) {
        console.error('Error fetching help videos:', err);
        setVideoError('Failed to load help videos');
      } finally {
        setLoadingVideos(false);
      }
    };

    fetchHelpVideos();
  }, []);

  const handleEditVideo = (video: HelpVideo) => {
    setEditingVideo(video)
    setEditTitle(video.title)
    setEditUrl(video.loom_url)
    setEditPosition(video.position)
    setVideoError(null)
    setUpdateSuccess(null)
  }

  const handleUpdateVideo = async () => {
    if (!editingVideo || !editTitle.trim() || !editUrl.trim()) {
      setVideoError('Please fill in all fields')
      return
    }

    try {
      setUpdatingVideo(true)
      setVideoError(null)
      
      const result = await updateHelpVideo(editingVideo.id, editTitle.trim(), editUrl.trim(), editPosition)
      
      if (result.success && result.data) {
        // Update local state and re-sort
        setHelpVideos(prev => 
          prev.map(v => v.id === editingVideo.id ? result.data! : v)
            .sort((a, b) => a.position - b.position)
        )
        setUpdateSuccess(`Successfully updated "${editTitle}"`)
        setEditingVideo(null)
        setEditTitle('')
        setEditUrl('')
        setEditPosition(1)
        
        // Clear success message after 3 seconds
        setTimeout(() => setUpdateSuccess(null), 3000)
      } else {
        setVideoError(result.error?.message || 'Failed to update video')
      }
    } catch (err) {
      console.error('Error updating video:', err)
      setVideoError('Failed to update video')
    } finally {
      setUpdatingVideo(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingVideo(null)
    setEditTitle('')
    setEditUrl('')
    setEditPosition(1)
    setVideoError(null)
    setUpdateSuccess(null)
  }

  const handleCreateVideo = async () => {
    if (!createTitle.trim() || !createUrl.trim()) {
      setVideoError('Please fill in all fields')
      return
    }

    try {
      setCreatingVideo(true)
      setVideoError(null)
      
      const result = await createHelpVideo(createTitle.trim(), createUrl.trim(), createVideoType, createPosition)
      
      if (result.success && result.data) {
        // Add to local state and re-sort
        setHelpVideos(prev => 
          [...prev, result.data!].sort((a, b) => a.position - b.position)
        )
        setUpdateSuccess(`Successfully created "${createTitle}"`)
        setShowCreateDialog(false)
        setCreateTitle('')
        setCreateUrl('')
        setCreateVideoType('tutorial')
        setCreatePosition(1)
        
        // Clear success message after 3 seconds
        setTimeout(() => setUpdateSuccess(null), 3000)
      } else {
        setVideoError(result.error?.message || 'Failed to create video')
      }
    } catch (err) {
      console.error('Error creating video:', err)
      setVideoError('Failed to create video')
    } finally {
      setCreatingVideo(false)
    }
  }

  const handleCancelCreate = () => {
    setShowCreateDialog(false)
    setCreateTitle('')
    setCreateUrl('')
    setCreateVideoType('tutorial')
    setCreatePosition(1)
    setVideoError(null)
    setUpdateSuccess(null)
  }

  const handleUpdateFirstLogin = () => {
    if (!firstLoginUrl.trim()) {
      setVideoError('Please enter a valid Loom URL')
      return
    }

    try {
      setUpdatingFirstLogin(true)
      setVideoError(null)
      
      // Save to localStorage
      localStorage.setItem('firstLoginVideoUrl', firstLoginUrl.trim())
      setFirstLoginVideoUrl(firstLoginUrl.trim())
      
      setUpdateSuccess('First Login Video updated successfully')
      setShowFirstLoginDialog(false)
      setFirstLoginUrl('')
      
      // Clear success message after 3 seconds
      setTimeout(() => setUpdateSuccess(null), 3000)
    } catch (err) {
      console.error('Error updating first login video:', err)
      setVideoError('Failed to update first login video')
    } finally {
      setUpdatingFirstLogin(false)
    }
  }

  const handleEditFirstLogin = () => {
    setFirstLoginUrl(firstLoginVideoUrl)
    setShowFirstLoginDialog(true)
    setVideoError(null)
    setUpdateSuccess(null)
  }

  const handleCancelFirstLogin = () => {
    setShowFirstLoginDialog(false)
    setFirstLoginUrl('')
    setVideoError(null)
  }

  const moveVideo = async (video: HelpVideo, direction: 'up' | 'down') => {
    const currentIndex = helpVideos.findIndex(v => v.id === video.id)
    const newPosition = direction === 'up' ? video.position - 1 : video.position + 1
    
    if (newPosition < 1) return
    
    try {
      const result = await updateHelpVideo(video.id, video.title, video.loom_url, newPosition)
      
      if (result.success && result.data) {
        setHelpVideos(prev => 
          prev.map(v => v.id === video.id ? result.data! : v)
            .sort((a, b) => a.position - b.position)
        )
      }
    } catch (err) {
      console.error('Error moving video:', err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Help Videos Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="h-6 w-6" />
              Help Videos Management
            </div>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Video
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {updateSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm mb-4">
              {updateSuccess}
            </div>
          )}
          
          {videoError && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm mb-4">
              {videoError}
            </div>
          )}
          
          {loadingVideos ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* First Login Video */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-sm">First Login</span>
                  Training Video for New Users
                </h3>
                <div className="space-y-4">
                  {firstLoginVideoUrl && (
                    <div className="border rounded-lg p-4 bg-amber-50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">First Login Training Video</h4>
                            <span className="text-xs bg-amber-200 text-amber-800 px-2 py-1 rounded">Active</span>
                          </div>
                          <div className="relative w-full max-w-sm">
                            <div className="relative w-full pb-[56.25%] h-0 rounded overflow-hidden">
                              <iframe
                                src={convertToEmbedUrl(firstLoginVideoUrl)}
                                frameBorder="0"
                                allow="autoplay; fullscreen; picture-in-picture"
                                allowFullScreen
                                className="absolute top-0 left-0 w-full h-full"
                                title="First Login Training Video"
                              />
                            </div>
                          </div>
                          <p className="text-sm text-amber-700 mt-2">
                            This video is shown to all new users when they first sign up.
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleEditFirstLogin}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  {!firstLoginVideoUrl && (
                    <div className="border-2 border-dashed border-amber-300 rounded-lg p-6 text-center bg-amber-50">
                      <p className="text-amber-700 mb-4">No First Login Video configured</p>
                      <Button
                        onClick={handleEditFirstLogin}
                        className="bg-amber-600 hover:bg-amber-700"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Login Video
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Showcase Videos */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">Showcase</span>
                  Main Platform Overview
                </h3>
                <div className="space-y-4">
                  {helpVideos.filter(v => v.video_type === 'showcase').map((video, index, filteredVideos) => (
                    <div key={video.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">{video.title}</h4>
                            <span className="text-sm text-gray-500">#{video.position}</span>
                          </div>
                          <div className="relative w-full max-w-sm">
                            <div className="relative w-full pb-[56.25%] h-0 rounded overflow-hidden">
                              <iframe
                                src={convertToEmbedUrl(video.loom_url)}
                                frameBorder="0"
                                allow="autoplay; fullscreen; picture-in-picture"
                                allowFullScreen
                                className="absolute top-0 left-0 w-full h-full"
                                title={video.title}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => moveVideo(video, 'up')}
                              disabled={index === 0}
                              title="Move up"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => moveVideo(video, 'down')}
                              disabled={index === filteredVideos.length - 1}
                              title="Move down"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditVideo(video)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tutorial Videos */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">Tutorials</span>
                  Step-by-Step Guides
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {helpVideos.filter(v => v.video_type === 'tutorial').map((video, index, filteredVideos) => (
                    <div key={video.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{video.title}</h4>
                          <span className="text-sm text-gray-500">#{video.position}</span>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => moveVideo(video, 'up')}
                            disabled={index === 0}
                            title="Move up"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => moveVideo(video, 'down')}
                            disabled={index === filteredVideos.length - 1}
                            title="Move down"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditVideo(video)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="relative w-full pb-[56.25%] h-0 rounded overflow-hidden">
                        <iframe
                          src={convertToEmbedUrl(video.loom_url)}
                          frameBorder="0"
                          allow="autoplay; fullscreen; picture-in-picture"
                          allowFullScreen
                          className="absolute top-0 left-0 w-full h-full"
                          title={video.title}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tips and Tricks Videos */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm">Tips & Tricks</span>
                  Pro Tips and Advanced Features
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {helpVideos.filter(v => v.video_type === 'tips').map((video, index, filteredVideos) => (
                    <div key={video.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{video.title}</h4>
                          <span className="text-sm text-gray-500">#{video.position}</span>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => moveVideo(video, 'up')}
                            disabled={index === 0}
                            title="Move up"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => moveVideo(video, 'down')}
                            disabled={index === filteredVideos.length - 1}
                            title="Move down"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditVideo(video)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="relative w-full pb-[56.25%] h-0 rounded overflow-hidden">
                        <iframe
                          src={convertToEmbedUrl(video.loom_url)}
                          frameBorder="0"
                          allow="autoplay; fullscreen; picture-in-picture"
                          allowFullScreen
                          className="absolute top-0 left-0 w-full h-full"
                          title={video.title}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Video Dialog */}
      <Dialog open={!!editingVideo} onOpenChange={(open) => !open && handleCancelEdit()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Help Video</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Video Title</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Enter video title..."
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-url">Loom URL</Label>
              <Input
                id="edit-url"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                placeholder="https://www.loom.com/share/..."
              />
              <p className="text-sm text-gray-500">
                Paste your Loom share or embed URL here
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-position">Order Position</Label>
              <Input
                id="edit-position"
                type="number"
                min="1"
                value={editPosition}
                onChange={(e) => setEditPosition(parseInt(e.target.value) || 1)}
                placeholder="1"
              />
              <p className="text-sm text-gray-500">
                Lower numbers appear first on the help page
              </p>
            </div>
            {videoError && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-md text-sm">
                {videoError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelEdit}
              disabled={updatingVideo}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleUpdateVideo}
              disabled={updatingVideo || !editTitle.trim() || !editUrl.trim()}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {updatingVideo ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Video Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => !open && handleCancelCreate()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Help Video</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-title">Video Title</Label>
              <Input
                id="create-title"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="Enter video title..."
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-url">Loom URL</Label>
              <Input
                id="create-url"
                value={createUrl}
                onChange={(e) => setCreateUrl(e.target.value)}
                placeholder="https://www.loom.com/share/..."
              />
              <p className="text-sm text-gray-500">
                Paste your Loom share or embed URL here
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-type">Video Type</Label>
              <Select value={createVideoType} onValueChange={(value: 'showcase' | 'tutorial' | 'tips') => setCreateVideoType(value)}>
                <SelectTrigger id="create-type">
                  <SelectValue placeholder="Select video type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="showcase">Showcase (Main Overview)</SelectItem>
                  <SelectItem value="tutorial">Tutorial (Step-by-Step)</SelectItem>
                  <SelectItem value="tips">Tips & Tricks (Pro Tips)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-position">Order Position</Label>
              <Input
                id="create-position"
                type="number"
                min="1"
                value={createPosition}
                onChange={(e) => setCreatePosition(parseInt(e.target.value) || 1)}
                placeholder="1"
              />
              <p className="text-sm text-gray-500">
                Lower numbers appear first on the help page
              </p>
            </div>
            {videoError && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-md text-sm">
                {videoError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelCreate}
              disabled={creatingVideo}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleCreateVideo}
              disabled={creatingVideo || !createTitle.trim() || !createUrl.trim()}
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              {creatingVideo ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Video
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* First Login Video Dialog */}
      <Dialog open={showFirstLoginDialog} onOpenChange={(open) => !open && handleCancelFirstLogin()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update First Login Video</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="first-login-url">Loom URL</Label>
              <Input
                id="first-login-url"
                value={firstLoginUrl}
                onChange={(e) => setFirstLoginUrl(e.target.value)}
                placeholder="https://www.loom.com/share/..."
              />
              <p className="text-sm text-gray-500">
                Paste your Loom share or embed URL here. This video will be shown to all new users.
              </p>
            </div>
            {videoError && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-md text-sm">
                {videoError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelFirstLogin}
              disabled={updatingFirstLogin}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleUpdateFirstLogin}
              disabled={updatingFirstLogin || !firstLoginUrl.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {updatingFirstLogin ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Update Video
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 