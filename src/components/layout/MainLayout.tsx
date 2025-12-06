"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  useMediaQuery,
  useTheme,
  Tabs,
  Tab,
  Tooltip,
} from "@mui/material";
import {
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  Dashboard as DashboardIcon,
  Engineering,
  Logout,
  Settings as SettingsIcon,
  People as PeopleIcon,
  Groups as GroupsIcon,
  AccessTime as AccessTimeIcon,
  AccountBalanceWallet as AccountBalanceWalletIcon,
  Description as DescriptionIcon,
  Assessment as AssessmentIcon,
  EventBusy as EventBusyIcon,
  Notes as NotesIcon,
  Business as BusinessIcon,
  Domain as DomainIcon,
  Person as PersonIcon,
  PaymentOutlined as PaymentIcon,
} from "@mui/icons-material";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import SiteSelector from "@/components/layout/SiteSelector";

const drawerWidth = 260;
const collapsedDrawerWidth = 0;

interface NavItem {
  text: string;
  icon: React.ReactElement;
  path: string;
  adminOnly?: boolean;
}

// Site-specific menu items
const siteNavItems: NavItem[] = [
  { text: "Dashboard", icon: <DashboardIcon />, path: "/site/dashboard" },
  {
    text: "Attendance",
    icon: <AccessTimeIcon />,
    path: "/site/attendance",
  },
  { text: "Holidays", icon: <EventBusyIcon />, path: "/site/holidays" },
  {
    text: "Daily Expenses",
    icon: <AccountBalanceWalletIcon />,
    path: "/site/expenses",
  },
  { text: "Daily Work Log", icon: <NotesIcon />, path: "/site/work-log" },
  {
    text: "Client Payments",
    icon: <PaymentIcon />,
    path: "/site/client-payments",
  },
  {
    text: "Subcontracts",
    icon: <DescriptionIcon />,
    path: "/site/subcontracts",
  },
  { text: "Site Reports", icon: <AssessmentIcon />, path: "/site/reports" },
];

// Company-wide menu items
const companyNavItems: NavItem[] = [
  { text: "Dashboard", icon: <DashboardIcon />, path: "/company/dashboard" },
  { text: "Laborers", icon: <PeopleIcon />, path: "/company/laborers" },
  { text: "Teams", icon: <GroupsIcon />, path: "/company/teams" },
  { text: "All Subcontracts", icon: <DescriptionIcon />, path: "/company/contracts" },
  {
    text: "Salary & Payments",
    icon: <AccountBalanceWalletIcon />,
    path: "/company/salary",
  },
  {
    text: "Engineer Wallet",
    icon: <PaymentIcon />,
    path: "/company/engineer-wallet",
  },
  {
    text: "Sites",
    icon: <DomainIcon />,
    path: "/company/sites",
    adminOnly: true,
  },
  {
    text: "Construction Phases",
    icon: <Engineering />, // construction-centric icon
    path: "/company/construction-phases",
    adminOnly: true,
  },
  {
    text: "Company Reports",
    icon: <AssessmentIcon />,
    path: "/company/reports",
  },
];

type ActiveTab = "site" | "company";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("site");

  const { userProfile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Determine active tab based on current path
  useEffect(() => {
    if (pathname.startsWith("/company")) {
      setActiveTab("company");
    } else if (pathname.startsWith("/site")) {
      setActiveTab("site");
    }
  }, [pathname]);

  const handleDrawerToggle = () => {
    if (isMobile) {
      setMobileOpen(!mobileOpen);
    } else {
      setSidebarCollapsed(!sidebarCollapsed);
    }
  };

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSignOut = async () => {
    handleUserMenuClose();
    await signOut();
    router.push("/login");
  };

  const handleSettings = () => {
    handleUserMenuClose();
    router.push("/settings");
  };

  const handleTabChange = (
    _event: React.SyntheticEvent,
    newValue: ActiveTab
  ) => {
    setActiveTab(newValue);
    // Navigate to the respective dashboard
    if (newValue === "site") {
      router.push("/site/dashboard");
    } else {
      router.push("/company/dashboard");
    }
  };

  const handleNavigation = (path: string) => {
    router.push(path);
    if (isMobile) setMobileOpen(false);
  };

  const currentNavItems = activeTab === "site" ? siteNavItems : companyNavItems;
  const filteredNavItems = currentNavItems.filter((item) => {
    if (item.adminOnly && userProfile?.role !== "admin") {
      return false;
    }
    return true;
  });

  const currentDrawerWidth =
    sidebarCollapsed && !isMobile ? collapsedDrawerWidth : drawerWidth;

  const drawer = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Logo Header */}
      <Toolbar
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 2,
          py: 2,
        }}
      >
        <Engineering sx={{ fontSize: 32, color: "primary.main", mr: 1 }} />
        <Typography variant="h6" fontWeight={600} color="primary">
          Aesta
        </Typography>
      </Toolbar>

      <Divider />

      {/* Tab Switcher */}
      <Box sx={{ px: 1, py: 1.5 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            minHeight: 40,
            bgcolor: "action.hover",
            borderRadius: 2,
            "& .MuiTabs-indicator": {
              height: "100%",
              borderRadius: 2,
              zIndex: 0,
            },
            "& .MuiTab-root": {
              minHeight: 40,
              zIndex: 1,
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.8rem",
            },
            "& .Mui-selected": {
              color: "white !important",
            },
          }}
        >
          <Tab
            icon={<DomainIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Site"
            value="site"
            sx={{ gap: 0.5 }}
          />
          <Tab
            icon={<BusinessIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Company"
            value="company"
            sx={{ gap: 0.5 }}
          />
        </Tabs>
      </Box>

      <Divider />

      {/* Navigation Menu */}
      <List sx={{ px: 1.5, py: 1, flexGrow: 1 }}>
        {filteredNavItems.map((item) => {
          const isActive =
            pathname === item.path || pathname.startsWith(`${item.path}/`);

          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => handleNavigation(item.path)}
                sx={{
                  borderRadius: 2,
                  py: 1,
                  bgcolor: isActive ? "primary.main" : "transparent",
                  color: isActive ? "white" : "text.primary",
                  "&:hover": {
                    bgcolor: isActive ? "primary.dark" : "action.hover",
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isActive ? "white" : "text.secondary",
                    minWidth: 40,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: isActive ? 600 : 400,
                    fontSize: "0.875rem",
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* Collapse Button - Desktop only */}
      {!isMobile && (
        <>
          <Divider />
          <Box sx={{ p: 1 }}>
            <ListItemButton
              onClick={() => setSidebarCollapsed(true)}
              sx={{
                borderRadius: 2,
                justifyContent: "center",
              }}
            >
              <ChevronLeftIcon />
              <ListItemText
                primary="Collapse"
                primaryTypographyProps={{ fontSize: "0.875rem" }}
                sx={{ ml: 1 }}
              />
            </ListItemButton>
          </Box>
        </>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: "flex" }}>
      {/* Top App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${currentDrawerWidth}px)` },
          ml: { md: `${currentDrawerWidth}px` },
          bgcolor: "white",
          color: "text.primary",
          transition: theme.transitions.create(["width", "margin"], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar>
          {/* Menu Toggle */}
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>

          {/* Site Selector - Only visible on Site tab */}
          <Box sx={{ flexGrow: 1 }}>
            {activeTab === "site" && <SiteSelector />}
            {activeTab === "company" && (
              <Typography variant="h6" fontWeight={500} color="text.secondary">
                Company Management
              </Typography>
            )}
          </Box>

          {/* User Avatar & Menu */}
          <Tooltip title="Account settings">
            <IconButton onClick={handleUserMenuOpen} sx={{ ml: 2 }}>
              <Avatar
                sx={{
                  bgcolor: "primary.main",
                  width: 38,
                  height: 38,
                  fontSize: "0.9rem",
                }}
              >
                {userProfile?.name?.charAt(0).toUpperCase() || "U"}
              </Avatar>
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleUserMenuClose}
            transformOrigin={{ horizontal: "right", vertical: "top" }}
            anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
            PaperProps={{
              sx: { minWidth: 220, mt: 1 },
            }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                {userProfile?.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {userProfile?.email}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  display: "inline-block",
                  mt: 0.5,
                  px: 1,
                  py: 0.25,
                  bgcolor: "primary.light",
                  color: "primary.dark",
                  borderRadius: 1,
                  fontWeight: 600,
                }}
              >
                {userProfile?.role?.toUpperCase()}
              </Typography>
            </Box>
            <Divider />
            {userProfile?.role === "admin" && (
              <MenuItem onClick={handleSettings}>
                <ListItemIcon>
                  <SettingsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Settings</ListItemText>
              </MenuItem>
            )}
            <MenuItem onClick={handleSignOut}>
              <ListItemIcon>
                <Logout fontSize="small" />
              </ListItemIcon>
              <ListItemText>Sign Out</ListItemText>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Sidebar Drawer */}
      <Box
        component="nav"
        sx={{
          width: { md: currentDrawerWidth },
          flexShrink: { md: 0 },
          transition: theme.transitions.create("width", {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        {/* Mobile Drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>

        {/* Desktop Drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: currentDrawerWidth,
              transition: theme.transitions.create("width", {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.leavingScreen,
              }),
              overflowX: "hidden",
            },
          }}
          open
        >
          {!sidebarCollapsed && drawer}
        </Drawer>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${currentDrawerWidth}px)` },
          minHeight: "100vh",
          bgcolor: "background.default",
          transition: theme.transitions.create(["width", "margin"], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
