# frozen_string_literal: true

# name: custom-group-banner
# about: TODO
# meta_topic_id: TODO
# version: 0.0.1
# authors: Discourse
# url: TODO
# required_version: 2.7.0

enabled_site_setting :custom_group_banner_enabled

module ::CustomGroupBanner
  PLUGIN_NAME = "custom-group-banner"
end

require_relative "lib/custom_group_banner/engine"

after_initialize do
  # Code which should run after Rails has finished booting
end
