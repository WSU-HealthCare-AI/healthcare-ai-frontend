import { useEffect, useState } from "react";
import { useRegistrationStore } from "@/src/entities/user/model/store";
import { supabase } from "@/src/shared/api/supabase";

export function useCurrentUserProfile() {
  const { profile, setProfile } = useRegistrationStore();
  const [userName, setUserName] = useState(
    profile.name ? `${profile.name}님` : "",
  );
  const [userId, setUserId] = useState<string | undefined>();
  const [userLoading, setUserLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchUserAndProfile = async () => {
      try {
        setUserLoading(true);
        const { data: { user } } = await supabase.auth.getUser();

        if (user && isMounted) {
          setUserId(user.id);

          if (!profile.name) {
            const { data } = await supabase
              .from("health_profiles")
              .select("name")
              .eq("user_id", user.id)
              .maybeSingle();

            if (data?.name && isMounted) {
              setUserName(`${data.name}님`);
              setProfile({ name: data.name });
            }
          }
        }
      } catch (err) {
        console.error("프로필 불러오기 실패:", err);
      } finally {
        if (isMounted) setUserLoading(false);
      }
    };

    fetchUserAndProfile();
    return () => {
      isMounted = false;
    };
  }, [profile.name, setProfile]);

  return { userId, userName, userLoading };
}
