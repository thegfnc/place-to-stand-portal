'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DisabledFieldTooltip } from "@/components/ui/disabled-field-tooltip";
import { useToast } from "@/components/ui/use-toast";

const UPLOAD_ENDPOINT = "/api/uploads/user-avatar";

type Props = {
  value: string | null;
  onChange: (next: string | null) => void;
  onRemovalChange: (removed: boolean) => void;
  initials: string;
  displayName?: string | null;
  disabled?: boolean;
  targetUserId?: string;
  existingUserId?: string | null;
};

export function AvatarUploadField({
  value,
  onChange,
  onRemovalChange,
  initials,
  displayName,
  disabled,
  targetUserId,
  existingUserId,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cacheBuster, setCacheBuster] = useState<string>(String(Date.now()));
  const [isUploading, setIsUploading] = useState(false);

  const avatarLabel = useMemo(() => displayName ?? initials, [displayName, initials]);

  const openFilePicker = useCallback(() => {
    if (disabled || isUploading) {
      return;
    }

    fileInputRef.current?.click();
  }, [disabled, isUploading]);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (!file) {
        return;
      }

      setIsUploading(true);

      const formData = new FormData();
      formData.append("file", file);

      if (targetUserId) {
        formData.append("targetUserId", targetUserId);
      }

      if (value) {
        formData.append("previousPath", value);
      }

      try {
        const response = await fetch(UPLOAD_ENDPOINT, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Upload failed");
        }

        const payload = (await response.json()) as { path: string };
        const objectUrl = URL.createObjectURL(file);

        onChange(payload.path);
        onRemovalChange(false);
        setPreviewUrl((current) => {
          if (current) {
            URL.revokeObjectURL(current);
          }

          return objectUrl;
        });
        setCacheBuster(String(Date.now()));
      } catch (error) {
        console.error("Avatar upload failed", error);
        toast({
          title: "Unable to upload avatar",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [onChange, onRemovalChange, targetUserId, toast, value]
  );

  const removeAvatar = useCallback(async () => {
    if (!value) {
      onChange(null);
      onRemovalChange(true);
      setPreviewUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }

        return null;
      });
      setCacheBuster(String(Date.now()));
      return;
    }

    setIsUploading(true);

    try {
      const response = await fetch(UPLOAD_ENDPOINT, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: value, targetUserId }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Removal failed");
      }

      onChange(null);
      onRemovalChange(true);
      setPreviewUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }

        return null;
      });
      setCacheBuster(String(Date.now()));
    } catch (error) {
      console.error("Failed to remove avatar", error);
      toast({
        title: "Unable to remove avatar",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [onChange, onRemovalChange, targetUserId, toast, value]);

  const remoteImage = useMemo(() => {
    if (previewUrl) {
      return previewUrl;
    }

    const resolvedUserId = existingUserId ?? targetUserId;

    if (value && resolvedUserId) {
      return `/api/storage/user-avatar/${resolvedUserId}?v=${cacheBuster}`;
    }

    return null;
  }, [cacheBuster, existingUserId, previewUrl, targetUserId, value]);

  const disableButtons = disabled || isUploading;
  const disabledReason = disableButtons ? "Please wait for the current request to finish." : null;

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);


  return (
    <div className="flex items-start gap-4">
      <Avatar className="h-16 w-16">
        {remoteImage ? (
          <AvatarImage src={remoteImage} alt={avatarLabel ?? "Avatar"} />
        ) : null}
        <AvatarFallback className="text-base font-semibold uppercase">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <DisabledFieldTooltip disabled={disableButtons} reason={disabledReason}>
            <Button type="button" variant="outline" size="sm" onClick={openFilePicker} disabled={disableButtons}>
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
              {value || previewUrl ? "Replace avatar" : "Upload avatar"}
            </Button>
          </DisabledFieldTooltip>
          {(value || previewUrl) && (
            <DisabledFieldTooltip disabled={disableButtons} reason={disabledReason}>
              <Button type="button" variant="secondary" size="sm" onClick={removeAvatar} disabled={disableButtons}>
                <Trash2 className="mr-2 h-4 w-4" /> Remove
              </Button>
            </DisabledFieldTooltip>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Square images up to 2MB. PNG, JPEG, WEBP, or GIF are supported.</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={handleFileChange}
      />
    </div>
  );
}
