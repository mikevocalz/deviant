import { create } from "zustand";

type ProfileTab = "posts" | "video" | "saved" | "tagged";

interface ProfileState {
  activeTab: ProfileTab;
  following: Record<string, boolean>;
  followers: Record<string, number>;
  editName: string;
  editBio: string;
  editWebsite: string;
  setActiveTab: (tab: ProfileTab) => void;
  toggleFollow: (userId: string, initialFollowers: number) => void;
  setEditName: (name: string) => void;
  setEditBio: (bio: string) => void;
  setEditWebsite: (website: string) => void;
  resetEditProfile: () => void;
}

const DEFAULT_PROFILE = {
  name: "",
  bio: "",
  website: "",
};

export const useProfileStore = create<ProfileState>((set) => ({
  activeTab: "posts",
  following: {},
  followers: {},
  editName: DEFAULT_PROFILE.name,
  editBio: DEFAULT_PROFILE.bio,
  editWebsite: DEFAULT_PROFILE.website,
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleFollow: (userId, initialFollowers) =>
    set((state) => {
      const isFollowing = state.following[userId];
      return {
        following: {
          ...state.following,
          [userId]: !isFollowing,
        },
        followers: {
          ...state.followers,
          [userId]:
            (state.followers[userId] || initialFollowers) +
            (isFollowing ? -1 : 1),
        },
      };
    }),
  setEditName: (name) => set({ editName: name }),
  setEditBio: (bio) => set({ editBio: bio }),
  setEditWebsite: (website) => set({ editWebsite: website }),
  resetEditProfile: () =>
    set({
      editName: DEFAULT_PROFILE.name,
      editBio: DEFAULT_PROFILE.bio,
      editWebsite: DEFAULT_PROFILE.website,
    }),
}));
