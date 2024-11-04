import Component from "@glimmer/component";
import { inject as service } from "@ember/service";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import { htmlSafe } from "@ember/template";
import { cook } from "discourse/lib/text";

export default class CustomGroupBanner extends Component {
  @service currentUser;
  @service siteSettings;
  @service messageBus;
  @tracked banners = [];
  @tracked localDismissedBanners = new Set();
  @tracked renderedMessages = new Map();

  constructor() {
    super(...arguments);
    this.banners = this._loadBanners();
    this._renderMessages();
    // Initialize localDismissedBanners with already dismissed banners
    if (this.currentUser?.dismissed_banners) {
      this.currentUser.dismissed_banners.forEach((key) =>
        this.localDismissedBanners.add(key)
      );
    }
    // Subscribe to MessageBus for real-time updates
    this.messageBus.subscribe("/site/banner", (data) => {
      if (data.event === "dismissals_cleared") {
        // Remove the cleared banner keys from local state
        data.banner_keys.forEach((key) => {
          this.localDismissedBanners.delete(key);
          if (this.currentUser?.dismissed_banners) {
            this.currentUser.dismissed_banners.removeObject(key);
          }
        });
        // Force a refresh of the component
        this.banners = this._loadBanners();
        this._renderMessages();
      }
    });
  }

  async _renderMessages() {
    const renderedMessages = new Map();

    for (const banner of this.banners) {
      if (banner.message) {
        try {
          const cooked = await cook(banner.message);
          renderedMessages.set(banner.id, htmlSafe(cooked));
        } catch (e) {
          renderedMessages.set(banner.id, htmlSafe(banner.message));
        }
      }
    }

    this.renderedMessages = renderedMessages;
  }

  _loadBanners() {
    const config = this.siteSettings.custom_group_banner_config;
    if (!config) {
      return [];
    }
    return config
      .split("|")
      .map((entry) => {
        try {
          const [id, group, message, dismissable, className] = entry
            .split(",")
            .map((s) => s.trim());
          return {
            id,
            group,
            message,
            dismissable: dismissable === "true",
            className,
          };
        } catch (e) {
          return null;
        }
      })
      .filter(
        (banner) => banner && banner.id && banner.group && banner.message
      );
  }

  get currentBanner() {
    const { currentUser } = this;
    if (!currentUser) {
      return null;
    }
    const userGroups = currentUser.groups.map((g) => g.name);

    const cbanner = this.banners.find((banner) => {
      return (
        userGroups.includes(banner.group) &&
        (!banner.dismissable || !this.localDismissedBanners.has(banner.id))
      );
    });

    if (cbanner) {
      const renderedMessage = this.renderedMessages.get(cbanner.id);
      return {
        ...cbanner,
        message: renderedMessage || cbanner.message,
      };
    }

    return null;
  }

  _getBannerKey(banner) {
    return `${banner.group}-${banner.message}`;
  }

  get shouldShowBanner() {
    return !!this.currentBanner;
  }

  get bannerClass() {
    return this.currentBanner?.className || "";
  }

  @action
  async dismissBanner() {
    const banner = this.currentBanner;
    if (!banner?.dismissable) {
      return;
    }

    // Update local state immediately
    this.localDismissedBanners = new Set([
      ...this.localDismissedBanners,
      banner.id,
    ]);

    try {
      await ajax("/banner/dismiss", {
        type: "POST",
        data: { banner_key: banner.id },
      });

      // Ensure dismissed_banners is initialized as an array
      if (!Array.isArray(this.currentUser.dismissed_banners)) {
        this.currentUser.set("dismissed_banners", []);
      }

      // Update the currentUser's dismissed_banners
      this.currentUser.dismissed_banners.pushObject(banner.id);
    } catch (error) {
      // If the server request fails, revert the local state
      this.localDismissedBanners.delete(banner.id);
    }
  }
}
