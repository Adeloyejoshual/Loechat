const AccountActionsSettings = ({ userId }) => {
  const themeContext = useContext(ThemeContext);
  const popupContext = usePopup();

  const theme = themeContext?.theme || "light";
  const showPopup = popupContext?.showPopup || (() => {});
  const isDark = theme === "dark";

  const handleDeleteAccount = async () => {
    if (!auth.currentUser) {
      showPopup("Please re-login and try again.");
      return;
    }

    if (!window.confirm("Are you sure? This cannot be undone!")) return;

    try {
      await deleteDoc(doc(db, "users", userId));
      await deleteUser(auth.currentUser);
      showPopup("✅ Account deleted");
      setTimeout(() => (window.location.href = "/signup"), 1500);
    } catch (err) {
      console.error(err);
      showPopup("❌ Failed to delete account.");
    }
  };